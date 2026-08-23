/**
 * Focus Blocker — Chrome Extension Service Worker
 *
 * Responsibilities:
 * 1. Listen for changes in chrome.storage.local (blocklist + active_session)
 * 2. When a session is active: install declarativeNetRequest dynamic rules
 *    that redirect all blocked domains → the extension's blocked page.
 * 3. When a session ends / stops: remove all dynamic blocking rules.
 * 4. Handle chrome.alarms for session auto-expiry.
 *
 * NO UI dependencies. Pure background logic.
 */

// ── Types (owned by popup/lib/storage; mirrored here for the worker bundle) ─

interface SessionBase {
  id: string;
  preset_id: string | null;
  mode: "blocklist" | "lockdown";
  started_at: string;
  planned_duration_sec: number;
  blocklist_snapshot: string[];
  whitelist_snapshot: string[];
  scheduled_schedule_id?: string | null;
}

/** A live session occupying the active slot. */
export interface ActiveSessionRecord extends SessionBase {
  status: "active";
  ended_at: null;
}

/** Why an archived session finished. Expire completes; stop/supersede stop. */
type ArchivedOutcome = "completed" | "stopped";

/** A finished session, as stored in history. */
export interface ArchivedSessionRecord extends SessionBase {
  status: ArchivedOutcome;
  ended_at: string;
}

interface Schedule {
  id: string;
  start_time: string;
  end_time: string;
  mode: "blocklist" | "lockdown";
  days_of_week?: number[];
  ends_on?: string | null;
}

interface ActiveChallenge {
  type: string;
  status: "pending" | "passed";
}

interface StorageData {
  blocklist: { id: number; domain: string }[];
  whitelist: { id: number; domain: string }[];
  temporary_allowlist: { id: string; domain: string; expires_at: number }[];
  schedules: Schedule[];
  active_session: ActiveSessionRecord | null;
  history: ArchivedSessionRecord[];
  schedule_suppressed_until: number | null;
  active_challenge: ActiveChallenge | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALARM_SESSION_EXPIRY = "focus_session_expiry";
const ALARM_SCHEDULE_BOUNDARY = "focus_schedule_boundary";
const ALARM_TEMP_ALLOW_EXPIRY = "focus_temp_allow_expiry";
// Rule IDs start at 1. We use IDs 1..N for blocked domains.
// We reserve no IDs for anything else.
const BASE_RULE_ID = 1;
const BLOCKED_PAGE_PATH = "blocked/index.html";

// ── Storage helpers ──────────────────────────────────────────────────────────

function storageGet<K extends keyof StorageData>(key: K): Promise<StorageData[K] | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] as StorageData[K] | undefined);
    });
  });
}

function storageSet<K extends keyof StorageData>(key: K, value: StorageData[K]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

/** Untyped read for keys whose stored value may predate the current shape. */
function storageGetRaw(key: string): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result[key]));
  });
}

/** Write only when the value actually differs, so reconcile passes never self-trigger. */
async function setIfChanged<K extends keyof StorageData>(key: K, value: StorageData[K]): Promise<boolean> {
  const current = await storageGet(key);
  if (JSON.stringify(current) === JSON.stringify(value)) return false;
  await storageSet(key, value);
  return true;
}

// ── Mutation lock ────────────────────────────────────────────────────────────
//
// All state-mutating work (reconcile passes, session start/stop/expire from the
// popup) runs inside one serialized queue. Overlapping triggers coalesce into a
// single follow-up pass instead of running concurrently, which is what used to
// lose history entries and temporary allows.

let mutationTail: Promise<unknown> = Promise.resolve();

export function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = mutationTail.then(task, task);
  mutationTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

let reconcileRequested = false;

export function requestReconcile(): Promise<void> {
  reconcileRequested = true;
  return withLock(async () => {
    while (reconcileRequested) {
      reconcileRequested = false;
      try {
        await applyBlockingState();
      } catch (error) {
        // A failed pass must never become an unhandled rejection; the next
        // trigger retries and blocking keeps working for valid entries.
        console.error("[FocusBlocker] Reconcile pass failed:", error);
      }
    }
  });
}

// ── Rule management ──────────────────────────────────────────────────────────

/**
 * Same contract as the popup's normalizeDomain validator: only plain domains
 * and leading-`*` wildcards over a safe charset may reach the rules engine.
 */
const SAFE_DOMAIN_CHARS = /^[a-z0-9.-]+$/;

export function isValidStoredDomain(domain: unknown): boolean {
  if (typeof domain !== "string") return false;
  const str = domain.toLowerCase();

  if (str.startsWith("*")) {
    const matchText = str.slice(1);
    return matchText.length > 0 && SAFE_DOMAIN_CHARS.test(matchText);
  }

  return str.includes(".") && SAFE_DOMAIN_CHARS.test(str);
}

/** Escape every regex metacharacter so a stored entry can never corrupt a regexFilter. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function addDomainRules(
  rules: chrome.declarativeNetRequest.Rule[],
  domain: string,
  priority: number,
  action: chrome.declarativeNetRequest.RuleAction,
  nextId: number
): number {
  if (!isValidStoredDomain(domain)) {
    if (domain) console.warn(`[FocusBlocker] Skipping invalid stored entry: ${JSON.stringify(domain)}`);
    return nextId;
  }

  const resourceTypes = [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME];
  if (domain.startsWith("*")) {
    const matchText = domain.slice(1);

    let ruleAction = action;
    let condition: chrome.declarativeNetRequest.RuleCondition = { urlFilter: `*${matchText}*`, resourceTypes };

    if (action.type === chrome.declarativeNetRequest.RuleActionType.REDIRECT && action.redirect?.url) {
      const regexStr = `^https?://.*${escapeRegex(matchText)}.*`;
      ruleAction = {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {
          regexSubstitution: `${action.redirect.url}?url=\\0`
        }
      };
      condition = { regexFilter: regexStr, resourceTypes };
    }

    rules.push({
      id: nextId++,
      priority,
      action: ruleAction,
      condition,
    });
    return nextId;
  }

  // Keep exact-domain behavior unchanged: main domain plus explicit www.
  for (const urlFilter of [`||${domain}^`, `||www.${domain}^`]) {
    let ruleAction = action;
    let condition: chrome.declarativeNetRequest.RuleCondition = { urlFilter, resourceTypes };

    if (action.type === chrome.declarativeNetRequest.RuleActionType.REDIRECT && action.redirect?.url) {
      // urlFilter format is ||domain^. To capture the full URL for substitution we use regexFilter.
      // match any protocol, optional subdomains matching our urlFilter intent, the domain, and any path.
      const isWww = urlFilter.startsWith('||www.');
      const exactDomain = isWww ? `www.${domain}` : domain;
      const regexStr = `^https?://([^/]*\\.)?(${escapeRegex(exactDomain)})(/.*)?$`;

      ruleAction = {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {
          regexSubstitution: `${action.redirect.url}?url=\\0`
        }
      };
      condition = { regexFilter: regexStr, resourceTypes };
    }

    rules.push({
      id: nextId++,
      priority,
      action: ruleAction,
      condition,
    });
  }
  return nextId;
}

/** Build blocklist rules. Allowlist entries use higher priority than blocks. */
export function buildRules(
  blocklist: string[],
  whitelist: string[],
  temporaryAllows: string[],
  extensionId: string
): chrome.declarativeNetRequest.Rule[] {
  const blockedPageUrl = `chrome-extension://${extensionId}/${BLOCKED_PAGE_PATH}`;
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let id = BASE_RULE_ID;

  for (const domain of whitelist) {
    id = addDomainRules(rules, domain, 2, { type: chrome.declarativeNetRequest.RuleActionType.ALLOW }, id);
  }
  for (const domain of temporaryAllows) {
    id = addDomainRules(rules, domain, 3, { type: chrome.declarativeNetRequest.RuleActionType.ALLOW }, id);
  }
  for (const domain of blocklist) {
    id = addDomainRules(rules, domain, 1, {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: { url: blockedPageUrl },
    }, id);
  }

  return rules;
}

/**
 * Given a whitelist, generate rules for lockdown mode.
 * Blocks EVERYTHING (priority 1) except whitelisted domains and extension pages (priority 2).
 */
export function buildLockdownRules(
  whitelist: string[],
  temporaryAllows: string[],
  extensionId: string
): chrome.declarativeNetRequest.Rule[] {
  const blockedPageUrl = `chrome-extension://${extensionId}/${BLOCKED_PAGE_PATH}`;
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let id = BASE_RULE_ID;

  // 1. Allow rules for whitelisted domains (priority 2)
  for (const domain of whitelist) {
    id = addDomainRules(rules, domain, 2, { type: chrome.declarativeNetRequest.RuleActionType.ALLOW }, id);
  }

  // Temporary exceptions always win, including when permanent rules conflict.
  for (const domain of temporaryAllows) {
    id = addDomainRules(rules, domain, 3, { type: chrome.declarativeNetRequest.RuleActionType.ALLOW }, id);
  }

  // 2. Allow rule for extension pages so the popup and blocked page still work (priority 2)
  rules.push({
    id: id++,
    priority: 2,
    action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
    condition: {
      urlFilter: `chrome-extension://${extensionId}/*`,
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
    },
  });

  // 3. Catch-all redirect rule (priority 1)
  rules.push({
    id: id++,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: { url: blockedPageUrl },
    },
    condition: {
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
    },
  });

  return rules;
}

/**
 * Remove all existing dynamic rules and optionally install new ones.
 * Skips the DNR round-trip when the rule set is byte-identical to the last
 * applied one, so reconcile passes never churn the rules engine.
 */
let lastRulesJson: string | null = null;

async function updateBlockingRules(newRules: chrome.declarativeNetRequest.Rule[]): Promise<void> {
  const json = JSON.stringify(newRules);
  if (json === lastRulesJson) return;

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map((r) => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: newRules,
  });
  lastRulesJson = json;

  console.log(
    `[FocusBlocker] Rules updated: removed ${existingIds.length}, added ${newRules.length}`
  );
}

/**
 * Clear all blocking rules (session ended).
 */
async function clearAllRules(): Promise<void> {
  await updateBlockingRules([]);
}

async function getActiveTemporaryAllows(): Promise<{ id: string; domain: string; expires_at: number }[]> {
  const entries = await storageGet("temporary_allowlist");
  const now = Date.now();
  const active = (Array.isArray(entries) ? entries : []).filter((entry) =>
    typeof entry?.id === "string" &&
    typeof entry.domain === "string" &&
    typeof entry.expires_at === "number" &&
    entry.expires_at > now
  );

  if (active.length !== (entries?.length ?? 0)) {
    await setIfChanged("temporary_allowlist", active);
  }
  return active;
}

async function scheduleTemporaryAllowExpiry(entries: { expires_at: number }[]): Promise<void> {
  await chrome.alarms.clear(ALARM_TEMP_ALLOW_EXPIRY);
  const nextExpiry = entries.reduce<number | null>((next, entry) =>
    next === null || entry.expires_at < next ? entry.expires_at : next,
  null);
  if (nextExpiry !== null) {
    await chrome.alarms.create(ALARM_TEMP_ALLOW_EXPIRY, { when: nextExpiry });
  }
}

// ── Recurring schedule helpers ──────────────────────────────────────────────

function timeToMinutes(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function scheduleDays(schedule: Schedule): number[] {
  const days = Array.isArray(schedule.days_of_week)
    ? [...new Set(schedule.days_of_week.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : [];
  // Legacy schedules had no weekday choice and always repeated daily.
  return days.length > 0 ? days : [0, 1, 2, 3, 4, 5, 6];
}

function scheduleRunsOn(schedule: Schedule, day: Date): boolean {
  const endsOn = typeof schedule.ends_on === "string" ? schedule.ends_on : null;
  return scheduleDays(schedule).includes(day.getDay()) && (endsOn === null || localDateKey(day) <= endsOn);
}

function getCurrentSchedule(schedules: Schedule[], now = new Date()): Schedule | null {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return schedules.find((schedule) => {
    const start = timeToMinutes(schedule.start_time);
    const end = timeToMinutes(schedule.end_time);
    return scheduleRunsOn(schedule, now) && start !== null && end !== null && start < end && currentMinutes >= start && currentMinutes < end;
  }) ?? null;
}

function getScheduleBoundary(schedule: Schedule, key: "start_time" | "end_time", day: Date): Date | null {
  const minutes = timeToMinutes(schedule[key]);
  if (minutes === null) return null;
  const boundary = new Date(day);
  boundary.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return boundary;
}

async function scheduleNextBoundaryAlarm(schedules: Schedule[]): Promise<void> {
  await chrome.alarms.clear(ALARM_SCHEDULE_BOUNDARY);
  if (schedules.length === 0) return;

  const now = new Date();
  const candidates: Date[] = [];
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);
    for (const schedule of schedules) {
      if (!scheduleRunsOn(schedule, day)) continue;
      const start = getScheduleBoundary(schedule, "start_time", day);
      const end = getScheduleBoundary(schedule, "end_time", day);
      if (start && start.getTime() > Date.now() + 500) candidates.push(start);
      if (end && end.getTime() > Date.now() + 500) candidates.push(end);
    }
  }

  const nextBoundary = candidates.sort((a, b) => a.getTime() - b.getTime())[0];
  if (nextBoundary) {
    await chrome.alarms.create(ALARM_SCHEDULE_BOUNDARY, { when: nextBoundary.getTime() });
  }
}

// ── Session finalize (the one shared transition) ─────────────────────────────
//
// Expiry, manual stop, and schedule supersede all end a session through
// finalizeActiveSession. There is exactly one way to move a record from the
// active slot into history.

async function pushHistory(archived: ArchivedSessionRecord): Promise<void> {
  const rawHistory = await storageGet("history");
  const history: ArchivedSessionRecord[] = Array.isArray(rawHistory) ? rawHistory : [];
  history.unshift(archived);
  await storageSet("history", history);
}

async function finalizeActiveSession(outcome: ArchivedOutcome): Promise<ArchivedSessionRecord | null> {
  const session = await storageGet("active_session");
  if (!session) return null;

  const archived: ArchivedSessionRecord = {
    ...session,
    status: outcome,
    ended_at: new Date().toISOString(),
  };
  await pushHistory(archived);
  await storageSet("active_session", null);
  return archived;
}

/**
 * A terminal-status record sitting in the active slot is a stray from a
 * partial write. On the next apply it is archived into history with its own
 * recorded end time (or now) and blocking rules are cleared.
 */
function isActiveSessionShape(value: unknown): value is ActiveSessionRecord {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.status === "active" &&
    (v.mode === "blocklist" || v.mode === "lockdown") &&
    typeof v.started_at === "string" &&
    typeof v.planned_duration_sec === "number" &&
    Array.isArray(v.blocklist_snapshot) &&
    Array.isArray(v.whitelist_snapshot)
  );
}

export async function migrateStrayActiveSession(): Promise<ActiveSessionRecord | null> {
  const value = await storageGetRaw("active_session");
  if (value === undefined || value === null) return null;

  if (isActiveSessionShape(value)) {
    // Normalize: live records never carry an end time.
    return { ...value, status: "active", ended_at: null };
  }

  const stray = value as Partial<ArchivedSessionRecord>;
  if (stray.status !== "completed" && stray.status !== "stopped") {
    console.warn("[FocusBlocker] Unrecognizable record in active slot; discarding.");
    await storageSet("active_session", null);
    return null;
  }

  console.warn("[FocusBlocker] Stray terminal record in active slot; archiving.");
  const archived: ArchivedSessionRecord = {
    id: typeof stray.id === "string" ? stray.id : `stray-${Date.now()}`,
    preset_id: typeof stray.preset_id === "string" ? stray.preset_id : null,
    mode: stray.mode === "lockdown" ? "lockdown" : "blocklist",
    started_at: typeof stray.started_at === "string" ? stray.started_at : new Date().toISOString(),
    planned_duration_sec:
      typeof stray.planned_duration_sec === "number" ? stray.planned_duration_sec : 0,
    blocklist_snapshot: Array.isArray(stray.blocklist_snapshot)
      ? stray.blocklist_snapshot
      : [],
    whitelist_snapshot: Array.isArray(stray.whitelist_snapshot)
      ? stray.whitelist_snapshot
      : [],
    scheduled_schedule_id:
      typeof stray.scheduled_schedule_id === "string" ? stray.scheduled_schedule_id : null,
    status: stray.status,
    ended_at: typeof stray.ended_at === "string" ? stray.ended_at : new Date().toISOString(),
  };
  await pushHistory(archived);
  await storageSet("active_session", null);
  await clearAllRules();
  await chrome.alarms.clear(ALARM_SESSION_EXPIRY);
  return null;
}

async function activateScheduledSession(schedule: Schedule, now: Date): Promise<ActiveSessionRecord> {
  const active = await storageGet("active_session");
  if (active) {
    // Superseded by the new scheduled session.
    await finalizeActiveSession("stopped");
  }

  const blocklist = ((await storageGet("blocklist")) ?? []).map((entry) => entry.domain);
  const whitelist = ((await storageGet("whitelist")) ?? []).map((entry) => entry.domain);
  const end = getScheduleBoundary(schedule, "end_time", now);
  const remaining = end ? Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1000)) : 1;
  const session: ActiveSessionRecord = {
    id: `scheduled-${schedule.id}-${now.getTime()}`,
    preset_id: null,
    mode: schedule.mode,
    started_at: now.toISOString(),
    ended_at: null,
    planned_duration_sec: remaining,
    status: "active",
    blocklist_snapshot: blocklist,
    whitelist_snapshot: whitelist,
    scheduled_schedule_id: schedule.id,
  };

  await storageSet("active_session", session);
  return session;
}

// ── Session expiry ───────────────────────────────────────────────────────────

export async function expireSession(): Promise<void> {
  const session = await storageGet("active_session");
  if (!session) return;

  // A manual session started after this expiry was scheduled must survive.
  // Stale alarms racing a fresh start are no-ops; real expiry still fires.
  if (!session.scheduled_schedule_id) {
    const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
    if (elapsed < session.planned_duration_sec) return;
  }

  await finalizeActiveSession("completed");

  await clearAllRules();
  await chrome.alarms.clear(ALARM_SESSION_EXPIRY);
  console.log("[FocusBlocker] Session expired, blocking rules cleared.");
}

// ── Core: apply state ────────────────────────────────────────────────────────

/**
 * Read current storage state and apply blocking rules accordingly.
 * Called on startup, on storage changes, and on alarm.
 */
export async function applyBlockingState(): Promise<void> {
  const schedules = (await storageGet("schedules")) ?? [];
  await scheduleNextBoundaryAlarm(schedules);
  const temporaryAllows = await getActiveTemporaryAllows();
  await scheduleTemporaryAllowExpiry(temporaryAllows);

  const suppressedUntil = await storageGet("schedule_suppressed_until");
  const scheduleSuppressed = typeof suppressedUntil === "number" && suppressedUntil > Date.now();
  if (typeof suppressedUntil === "number" && !scheduleSuppressed) {
    await setIfChanged("schedule_suppressed_until", null);
  }

  const currentSchedule = scheduleSuppressed ? null : getCurrentSchedule(schedules);
  // Reads also migrate any stray terminal record out of the active slot.
  let session = await migrateStrayActiveSession();

  if (currentSchedule) {
    if (!session || session.scheduled_schedule_id !== currentSchedule.id) {
      session = await activateScheduledSession(currentSchedule, new Date());
    } else {
      const end = getScheduleBoundary(currentSchedule, "end_time", new Date());
      if (end && end.getTime() <= Date.now()) {
        await expireSession();
        return;
      }
      // planned_duration_sec stays frozen at the activation value; the expiry
      // alarm below is recomputed from live time without rewriting storage.
    }
  } else if (session?.scheduled_schedule_id) {
    await expireSession();
    return;
  }

  if (!session) {
    // No active session — clear all rules
    await clearAllRules();
    await chrome.alarms.clear(ALARM_SESSION_EXPIRY);
    return;
  }

  // Check if session has already expired
  const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
  if (!session.scheduled_schedule_id && elapsed >= session.planned_duration_sec) {
    await expireSession();
    return;
  }

  const extensionId = chrome.runtime.id;
  let rules: chrome.declarativeNetRequest.Rule[];

  if (session.mode === "lockdown") {
    rules = buildLockdownRules(
      session.whitelist_snapshot,
      temporaryAllows.map((entry) => entry.domain),
      extensionId
    );
  } else {
    rules = buildRules(
      session.blocklist_snapshot,
      session.whitelist_snapshot,
      temporaryAllows.map((entry) => entry.domain),
      extensionId
    );
  }

  await updateBlockingRules(rules);

  // Schedule alarm for session expiry. Scheduled sessions track the live
  // schedule boundary; manual sessions count down from started_at.
  let remainingSec: number;
  if (session.scheduled_schedule_id && currentSchedule?.id === session.scheduled_schedule_id) {
    const end = getScheduleBoundary(currentSchedule, "end_time", new Date());
    remainingSec = end ? Math.max(1, Math.ceil((end.getTime() - Date.now()) / 1000)) : 1;
  } else {
    remainingSec = Math.max(1, session.planned_duration_sec - elapsed);
  }
  const remainingMs = remainingSec * 1000;
  chrome.alarms.create(ALARM_SESSION_EXPIRY, {
    when: Date.now() + remainingMs,
  });

  console.log(
    `[FocusBlocker] Session active (${session.mode}). Expires in ${Math.round(remainingSec / 60)}m.`
  );
}

// ── Popup-driven session mutations ───────────────────────────────────────────
//
// The popup no longer mutates active_session/history directly. Every mutation
// runs inside the mutation lock here, so rapid clicks and expiry alarms
// serialize instead of racing read-modify-write updates.

export async function startSessionLocked(
  mode: ActiveSessionRecord["mode"],
  duration_minutes: number,
  preset_id?: string
): Promise<null> {
  return withLock(async () => {
    const active = await storageGet("active_session");
    if (active) {
      throw new Error("A session is already active");
    }

    const blocklist = ((await storageGet("blocklist")) ?? []).map((d) => d.domain);
    const whitelist = ((await storageGet("whitelist")) ?? []).map((d) => d.domain);

    const newSession: ActiveSessionRecord = {
      id: Math.random().toString(36).substring(2, 11),
      preset_id: preset_id ?? null,
      mode,
      started_at: new Date().toISOString(),
      ended_at: null,
      planned_duration_sec: duration_minutes * 60,
      status: "active",
      blocklist_snapshot: blocklist,
      whitelist_snapshot: whitelist,
    };

    await storageSet("active_session", newSession);
    await applyBlockingState();
    return null;
  });
}

export async function stopSessionLocked(): Promise<null> {
  return withLock(async () => {
    const active = await storageGet("active_session");
    if (active) {
      if (active.scheduled_schedule_id) {
        const schedules = (await storageGet("schedules")) ?? [];
        const schedule = schedules.find((item) => item.id === active.scheduled_schedule_id);
        const endMinutes = schedule ? timeToMinutes(schedule.end_time) : null;
        const scheduledEnd = endMinutes === null ? null : new Date();
        if (scheduledEnd && endMinutes !== null) {
          scheduledEnd.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
        }
        await setIfChanged(
          "schedule_suppressed_until",
          scheduledEnd && scheduledEnd.getTime() > Date.now()
            ? scheduledEnd.getTime()
            : Date.now() + active.planned_duration_sec * 1000
        );
      }

      // The one shared finalize transition; expiry uses it with "completed".
      await finalizeActiveSession("stopped");

      await setIfChanged("active_challenge", null);
      await applyBlockingState();
    }
    return null;
  });
}

interface BackgroundResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

async function handleBackgroundMessage(message: unknown): Promise<unknown> {
  const request = message as { type?: string; mode?: string; duration_minutes?: number; preset_id?: string };
  switch (request?.type) {
    case "session:start":
      return startSessionLocked(
        request.mode === "lockdown" ? "lockdown" : "blocklist",
        typeof request.duration_minutes === "number" ? request.duration_minutes : 0,
        request.preset_id
      );
    case "session:stop":
      return stopSessionLocked();
    case "session:expire":
      return withLock(async () => {
        await expireSession();
        return null;
      });
    default:
      throw new Error(`Unknown background message type`);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleBackgroundMessage(message)
    .then((result) => {
      const response: BackgroundResponse = { ok: true, result };
      sendResponse(response);
    })
    .catch((error: unknown) => {
      const response: BackgroundResponse = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
      sendResponse(response);
    });
  return true; // async sendResponse
});

// ── Event listeners ──────────────────────────────────────────────────────────

// On install / update
chrome.runtime.onInstalled.addListener(() => {
  console.log("[FocusBlocker] Extension installed/updated. Applying state.");
  void requestReconcile();
});

// On browser startup (service worker restarts)
chrome.runtime.onStartup.addListener(() => {
  console.log("[FocusBlocker] Browser started. Applying state.");
  void requestReconcile();
});

// React to storage changes (popup writes to storage → service worker reacts)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  const relevantKeys = ["active_session", "blocklist", "whitelist", "temporary_allowlist", "schedules"];
  const hasRelevantChange = relevantKeys.some((k) => k in changes);
  if (!hasRelevantChange) return;

  console.log("[FocusBlocker] Storage changed:", Object.keys(changes));
  void requestReconcile();
});

// Alarm fires when session should expire
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_SESSION_EXPIRY) {
    console.log("[FocusBlocker] Session expiry alarm fired.");
    void requestReconcile();
  }
  if (alarm.name === ALARM_SCHEDULE_BOUNDARY) {
    console.log("[FocusBlocker] Schedule boundary alarm fired.");
    void requestReconcile();
  }
  if (alarm.name === ALARM_TEMP_ALLOW_EXPIRY) {
    console.log("[FocusBlocker] Temporary allow expired.");
    void requestReconcile();
  }
});
