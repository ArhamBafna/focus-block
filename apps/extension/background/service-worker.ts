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

// ── Types (mirrored from popup/lib/ipc.ts) ──────────────────────────────────

interface Session {
  id: string;
  preset_id: string | null;
  mode: "blocklist" | "lockdown";
  started_at: string;
  ended_at: string | null;
  planned_duration_sec: number;
  status: "active" | "completed" | "stopped";
  blocklist_snapshot: string[];
  whitelist_snapshot: string[];
  scheduled_schedule_id?: string | null;
}

interface Schedule {
  id: string;
  start_time: string;
  end_time: string;
  mode: "blocklist" | "lockdown";
  days_of_week?: number[];
  ends_on?: string | null;
}

interface StorageData {
  blocklist: { id: number; domain: string }[];
  whitelist: { id: number; domain: string }[];
  schedules: Schedule[];
  active_session: Session | null;
  history: Session[];
  schedule_suppressed_until: number | null;
  settings: { os_allowlist_enabled: boolean };
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALARM_SESSION_EXPIRY = "focus_session_expiry";
const ALARM_SCHEDULE_BOUNDARY = "focus_schedule_boundary";
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

// ── Rule management ──────────────────────────────────────────────────────────

/**
 * Given a list of domains to block, generate declarativeNetRequest rules.
 * Each domain gets two rules: bare domain + www. subdomain.
 * Rules redirect matching requests to the extension's blocked page.
 */
function buildRules(domains: string[], extensionId: string): chrome.declarativeNetRequest.Rule[] {
  const blockedPageUrl = `chrome-extension://${extensionId}/${BLOCKED_PAGE_PATH}`;
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let id = BASE_RULE_ID;

  for (const domain of domains) {
    if (!domain) continue;

    // Match bare domain
    rules.push({
      id: id++,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: { url: blockedPageUrl },
      },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
        ],
      },
    });

    // Match www. subdomain (in case urlFilter doesn't catch it)
    rules.push({
      id: id++,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: { url: blockedPageUrl },
      },
      condition: {
        urlFilter: `||www.${domain}^`,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
        ],
      },
    });
  }

  return rules;
}

/**
 * Given a whitelist, generate rules for lockdown mode.
 * Blocks EVERYTHING (priority 1) except whitelisted domains and extension pages (priority 2).
 */
function buildLockdownRules(whitelist: string[], extensionId: string): chrome.declarativeNetRequest.Rule[] {
  const blockedPageUrl = `chrome-extension://${extensionId}/${BLOCKED_PAGE_PATH}`;
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let id = BASE_RULE_ID;

  // 1. Allow rules for whitelisted domains (priority 2)
  for (const domain of whitelist) {
    if (!domain) continue;

    rules.push({
      id: id++,
      priority: 2,
      action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
      },
    });
    rules.push({
      id: id++,
      priority: 2,
      action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
      condition: {
        urlFilter: `||www.${domain}^`,
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
      },
    });
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
 */
async function updateBlockingRules(newRules: chrome.declarativeNetRequest.Rule[]): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map((r) => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: newRules,
  });

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

async function archiveActiveSession(session: Session): Promise<void> {
  session.status = "stopped";
  session.ended_at = new Date().toISOString();
  const rawHistory = await storageGet("history");
  const history: Session[] = Array.isArray(rawHistory) ? rawHistory : [];
  history.unshift(session);
  await storageSet("history", history);
}

async function activateScheduledSession(schedule: Schedule, now: Date): Promise<Session> {
  const active = await storageGet("active_session");
  if (active && active.status === "active") {
    await archiveActiveSession(active);
  }

  const blocklist = ((await storageGet("blocklist")) ?? []).map((entry) => entry.domain);
  const whitelist = ((await storageGet("whitelist")) ?? []).map((entry) => entry.domain);
  const end = getScheduleBoundary(schedule, "end_time", now);
  const remaining = end ? Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 1000)) : 1;
  const session: Session = {
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

async function expireSession(): Promise<void> {
  const session = await storageGet("active_session");
  if (!session || session.status !== "active") return;

  session.status = "completed";
  session.ended_at = new Date().toISOString();

  const rawHistory = await storageGet("history");
  const history: Session[] = Array.isArray(rawHistory) ? rawHistory : [];
  history.unshift(session);

  await storageSet("history", history);
  await storageSet("active_session", null);

  await clearAllRules();
  await chrome.alarms.clear(ALARM_SESSION_EXPIRY);
  console.log("[FocusBlocker] Session expired, blocking rules cleared.");
}

// ── Core: apply state ────────────────────────────────────────────────────────

/**
 * Read current storage state and apply blocking rules accordingly.
 * Called on startup, on storage changes, and on alarm.
 */
async function applyBlockingState(): Promise<void> {
  const schedules = (await storageGet("schedules")) ?? [];
  await scheduleNextBoundaryAlarm(schedules);

  const suppressedUntil = await storageGet("schedule_suppressed_until");
  const scheduleSuppressed = typeof suppressedUntil === "number" && suppressedUntil > Date.now();
  if (typeof suppressedUntil === "number" && !scheduleSuppressed) {
    await storageSet("schedule_suppressed_until", null);
  }

  const currentSchedule = scheduleSuppressed ? null : getCurrentSchedule(schedules);
  let session = await storageGet("active_session");

  if (currentSchedule) {
    if (!session || session.status !== "active" || session.scheduled_schedule_id !== currentSchedule.id) {
      session = await activateScheduledSession(currentSchedule, new Date());
    } else {
      const end = getScheduleBoundary(currentSchedule, "end_time", new Date());
      if (end && end.getTime() <= Date.now()) {
        await expireSession();
        return;
      }
      if (end) {
        session.planned_duration_sec = Math.max(1, Math.ceil((end.getTime() - Date.now()) / 1000));
        await storageSet("active_session", session);
      }
    }
  } else if (session?.scheduled_schedule_id) {
    await expireSession();
    return;
  }

  if (!session || session.status !== "active") {
    // No active session — clear all rules
    await clearAllRules();
    chrome.alarms.clear(ALARM_SESSION_EXPIRY);
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
    rules = buildLockdownRules(session.whitelist_snapshot, extensionId);
  } else {
    rules = buildRules(session.blocklist_snapshot, extensionId);
  }

  await updateBlockingRules(rules);

  // Schedule alarm for session expiry
  const remainingSec = session.scheduled_schedule_id
    ? session.planned_duration_sec
    : session.planned_duration_sec - elapsed;
  const remainingMs = remainingSec * 1000;
  chrome.alarms.create(ALARM_SESSION_EXPIRY, {
    when: Date.now() + remainingMs,
  });

  console.log(
    `[FocusBlocker] Session active (${session.mode}). Expires in ${Math.round(remainingSec / 60)}m.`
  );
}

// ── Event listeners ──────────────────────────────────────────────────────────

// On install / update
chrome.runtime.onInstalled.addListener(async () => {
  console.log("[FocusBlocker] Extension installed/updated. Applying state.");
  await applyBlockingState();
});

// On browser startup (service worker restarts)
chrome.runtime.onStartup.addListener(async () => {
  console.log("[FocusBlocker] Browser started. Applying state.");
  await applyBlockingState();
});

// React to storage changes (popup writes to storage → service worker reacts)
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;

  const relevantKeys = ["active_session", "blocklist", "whitelist", "schedules"];
  const hasRelevantChange = relevantKeys.some((k) => k in changes);
  if (!hasRelevantChange) return;

  console.log("[FocusBlocker] Storage changed:", Object.keys(changes));
  await applyBlockingState();
});

// Alarm fires when session should expire
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_SESSION_EXPIRY) {
    console.log("[FocusBlocker] Session expiry alarm fired.");
    await expireSession();
    await applyBlockingState();
  }
  if (alarm.name === ALARM_SCHEDULE_BOUNDARY) {
    console.log("[FocusBlocker] Schedule boundary alarm fired.");
    await applyBlockingState();
  }
});
