/**
 * Browser-first FocusBlock enforcement. chrome.storage.local is canonical for
 * extension features. Native messaging is an optional desktop mirror only.
 */

type SessionMode = "blocklist" | "lockdown";
type SyncScope = "blocklist" | "whitelist";

interface Session {
  id: string;
  mode: SessionMode;
  started_at: string;
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
  mode: SessionMode;
  days_of_week: number[];
  ends_on: string | null;
}

interface DomainEntry { id: number; domain: string; }
interface TemporaryAllow { id: string; domain: string; expires_at: number; }
interface DesktopPolicy {
  active: boolean;
  mode: SessionMode | null;
  blocklist: string[];
  whitelist: string[];
  blocked_domains: string[];
  allowed_domains: string[];
  expires_at: string | null;
  error?: string;
}

interface NativeResponse { status: "Ok" | "Err"; data?: unknown; message?: string; }
interface BrowserSyncMessage {
  type: "focusblock-browser-sync";
  reason: "refresh" | "list-change";
  scope?: SyncScope;
  operation?: "add" | "remove";
  domain?: string;
}

const NATIVE_HOST_NAME = "com.focusblock.bridge";
const ALARM_SESSION_EXPIRY = "focus_session_expiry";
const ALARM_SCHEDULE_BOUNDARY = "focus_schedule_boundary";
const ALARM_TEMP_ALLOW_EXPIRY = "focus_temp_allow_expiry";
const ALARM_DESKTOP_SYNC = "focus_desktop_sync";
const BLOCKED_PAGE_PATH = "/blocked/index.html";
const FOCUSBLOCK_RULE_ID_MIN = 1;
const FOCUSBLOCK_RULE_ID_MAX = 30_000;

const FRAME_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
  chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function parseDesktopPolicy(value: unknown): DesktopPolicy | null {
  if (!isRecord(value) || typeof value.active !== "boolean" || (value.mode !== "blocklist" && value.mode !== "lockdown" && value.mode !== null)) return null;
  const blocklist = asStringArray(value.blocklist);
  const whitelist = asStringArray(value.whitelist);
  const blocked = asStringArray(value.blocked_domains);
  const allowed = asStringArray(value.allowed_domains);
  if (!blocklist || !whitelist || !blocked || !allowed || (value.expires_at !== null && typeof value.expires_at !== "string")) return null;
  return { active: value.active, mode: value.mode, blocklist, whitelist, blocked_domains: blocked, allowed_domains: allowed, expires_at: value.expires_at, error: typeof value.error === "string" ? value.error : undefined };
}

function targetToUrlFilter(rawTarget: string): string | null {
  const target = rawTarget.trim().toLowerCase();
  if (!target) return null;
  if (target.startsWith("*")) return /^[a-z0-9._/-]+$/.test(target.slice(1)) ? `*${target.slice(1)}*` : null;
  const domain = target.replace(/^https?:\/\//, "").split(/[/?#]/, 1)[0]?.split(":", 1)[0]?.replace(/^www\./, "") ?? "";
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(domain) ? `||${domain}^` : null;
}

function appendRule(rules: chrome.declarativeNetRequest.Rule[], id: number, priority: number, action: chrome.declarativeNetRequest.RuleAction, urlFilter?: string): number {
  if (id > FOCUSBLOCK_RULE_ID_MAX) throw new Error("FocusBlock policy exceeds Chrome dynamic-rule capacity.");
  rules.push({ id, priority, action, condition: { ...(urlFilter ? { urlFilter } : {}), resourceTypes: FRAME_TYPES } });
  return id + 1;
}

function addDomainRules(rules: chrome.declarativeNetRequest.Rule[], values: string[], id: number, priority: number, action: chrome.declarativeNetRequest.RuleAction): number {
  for (const value of new Set(values)) {
    const filter = targetToUrlFilter(value);
    if (filter) id = appendRule(rules, id, priority, action, filter);
  }
  return id;
}

function intersect(first: string[], second: string[]): string[] {
  const allowed = new Set(second);
  return first.filter((item) => allowed.has(item));
}

function buildRules(local: Session | null, desktop: Session | null, temporaryAllows: string[]): chrome.declarativeNetRequest.Rule[] {
  const sessions = [local, desktop].filter((session): session is Session => session?.status === "active");
  if (sessions.length === 0) return [];
  const lockDowns = sessions.filter((session) => session.mode === "lockdown");
  const focusBlocks = sessions.filter((session) => session.mode === "blocklist").flatMap((session) => session.blocklist_snapshot);
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let id = FOCUSBLOCK_RULE_ID_MIN;
  const redirect: chrome.declarativeNetRequest.RuleAction = { type: chrome.declarativeNetRequest.RuleActionType.REDIRECT, redirect: { extensionPath: BLOCKED_PAGE_PATH } };

  if (lockDowns.length === 0) {
    const allowed = sessions.flatMap((session) => session.whitelist_snapshot);
    id = addDomainRules(rules, allowed, id, 4, { type: chrome.declarativeNetRequest.RuleActionType.ALLOW });
    id = addDomainRules(rules, temporaryAllows, id, 5, { type: chrome.declarativeNetRequest.RuleActionType.ALLOW });
    addDomainRules(rules, focusBlocks, id, 2, redirect);
    return rules;
  }

  let lockdownAllows = [...lockDowns[0].whitelist_snapshot];
  for (const session of lockDowns.slice(1)) lockdownAllows = intersect(lockdownAllows, session.whitelist_snapshot);
  id = addDomainRules(rules, lockdownAllows, id, 4, { type: chrome.declarativeNetRequest.RuleActionType.ALLOW });
  // A temporary browser exception may not weaken a desktop lockdown.
  if (!desktop || desktop.mode !== "lockdown") id = addDomainRules(rules, temporaryAllows, id, 5, { type: chrome.declarativeNetRequest.RuleActionType.ALLOW });
  id = addDomainRules(rules, focusBlocks, id, 6, redirect);
  appendRule(rules, id, 1, redirect);
  return rules;
}

async function updateRules(rules: chrome.declarativeNetRequest.Rule[]): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.filter((rule) => rule.id >= FOCUSBLOCK_RULE_ID_MIN && rule.id <= FOCUSBLOCK_RULE_ID_MAX).map((rule) => rule.id),
    addRules: rules,
  });
}

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const value = (await chrome.storage.local.get(key))[key];
  return (value === undefined ? fallback : value) as T;
}

async function setLocal(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

function timeToMinutes(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function scheduleRunsNow(schedule: Schedule, now: Date): boolean {
  const start = timeToMinutes(schedule.start_time);
  const end = timeToMinutes(schedule.end_time);
  const days = schedule.days_of_week?.length ? schedule.days_of_week : [0, 1, 2, 3, 4, 5, 6];
  const current = now.getHours() * 60 + now.getMinutes();
  return start !== null && end !== null && start < end && days.includes(now.getDay()) && (schedule.ends_on === null || localDateKey(now) <= schedule.ends_on) && current >= start && current < end;
}

function scheduleEnd(schedule: Schedule, now: Date): Date | null {
  const minutes = timeToMinutes(schedule.end_time);
  if (minutes === null) return null;
  const end = new Date(now);
  end.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return end;
}

async function archive(session: Session, status: "completed" | "stopped"): Promise<void> {
  const history = await getLocal<Session[]>("history", []);
  await setLocal("history", [{ ...session, status, ended_at: new Date().toISOString() }, ...history]);
}

async function activeTemporaryAllows(): Promise<TemporaryAllow[]> {
  const active = (await getLocal<TemporaryAllow[]>("temporary_allowlist", [])).filter((entry) => entry.expires_at > Date.now());
  await setLocal("temporary_allowlist", active);
  await chrome.alarms.clear(ALARM_TEMP_ALLOW_EXPIRY);
  const expiry = active.reduce<number | null>((next, entry) => next === null || entry.expires_at < next ? entry.expires_at : next, null);
  if (expiry !== null) await chrome.alarms.create(ALARM_TEMP_ALLOW_EXPIRY, { when: expiry });
  return active;
}

async function scheduleBoundaryAlarm(schedules: Schedule[]): Promise<void> {
  await chrome.alarms.clear(ALARM_SCHEDULE_BOUNDARY);
  const now = new Date();
  const boundaries: number[] = [];
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);
    for (const schedule of schedules) {
      const days = schedule.days_of_week?.length ? schedule.days_of_week : [0, 1, 2, 3, 4, 5, 6];
      if (!days.includes(day.getDay()) || (schedule.ends_on !== null && localDateKey(day) > schedule.ends_on)) continue;
      for (const value of [schedule.start_time, schedule.end_time]) {
        const minute = timeToMinutes(value);
        if (minute !== null) {
          const at = new Date(day);
          at.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
          if (at.getTime() > Date.now() + 500) boundaries.push(at.getTime());
        }
      }
    }
  }
  const next = boundaries.sort((a, b) => a - b)[0];
  if (next) await chrome.alarms.create(ALARM_SCHEDULE_BOUNDARY, { when: next });
}

async function applyBlockingState(): Promise<void> {
  const now = new Date();
  const schedules = await getLocal<Schedule[]>("schedules", []);
  await scheduleBoundaryAlarm(schedules);
  const temporaryAllows = await activeTemporaryAllows();
  let local = await getLocal<Session | null>("active_session", null);
  const suppression = await getLocal<number | null>("schedule_suppressed_until", null);
  const scheduled = suppression && suppression > Date.now() ? null : schedules.find((schedule) => scheduleRunsNow(schedule, now)) ?? null;
  if (suppression && suppression <= Date.now()) await setLocal("schedule_suppressed_until", null);
  if (scheduled && (!local || local.scheduled_schedule_id !== scheduled.id)) {
    if (local?.status === "active") await archive(local, "stopped");
    const blocklist = (await getLocal<DomainEntry[]>("blocklist", [])).map((entry) => entry.domain);
    const whitelist = (await getLocal<DomainEntry[]>("whitelist", [])).map((entry) => entry.domain);
    const end = scheduleEnd(scheduled, now);
    local = { id: `scheduled-${scheduled.id}-${Date.now()}`, mode: scheduled.mode, started_at: now.toISOString(), planned_duration_sec: Math.max(1, Math.ceil(((end?.getTime() ?? Date.now() + 1_000) - Date.now()) / 1_000)), status: "active", blocklist_snapshot: blocklist, whitelist_snapshot: whitelist, scheduled_schedule_id: scheduled.id };
    await setLocal("active_session", local);
  }
  if (local?.scheduled_schedule_id && !scheduled) {
    await archive(local, "completed");
    local = null;
    await setLocal("active_session", null);
  }
  if (local?.status === "active" && Date.now() >= new Date(local.started_at).getTime() + local.planned_duration_sec * 1_000) {
    await archive(local, "completed");
    local = null;
    await setLocal("active_session", null);
  }
  let desktop = await getLocal<Session | null>("desktop_session", null);
  if (desktop?.status === "active" && Date.now() >= new Date(desktop.started_at).getTime() + desktop.planned_duration_sec * 1_000) {
    desktop = null;
    await setLocal("desktop_session", null);
  }
  await updateRules(buildRules(local?.status === "active" ? local : null, desktop?.status === "active" ? desktop : null, temporaryAllows.map((entry) => entry.domain)));
  await chrome.alarms.clear(ALARM_SESSION_EXPIRY);
  const expiries = [local, desktop].filter((session): session is Session => session?.status === "active").map((session) => new Date(session.started_at).getTime() + session.planned_duration_sec * 1_000);
  if (expiries.length) await chrome.alarms.create(ALARM_SESSION_EXPIRY, { when: Math.min(...expiries) });
}

function isNativeResponse(value: unknown): value is NativeResponse {
  return isRecord(value) && (value.status === "Ok" || value.status === "Err");
}

async function serviceRequest(cmd: string, data?: unknown): Promise<NativeResponse> {
  const response = await chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, { type: "service-request", request: data === undefined ? { cmd } : { cmd, data } });
  if (!isNativeResponse(response)) throw new Error("Invalid native response.");
  if (response.status === "Err") throw new Error(response.message ?? "Desktop service rejected request.");
  return response;
}

async function remoteList(scope: SyncScope): Promise<DomainEntry[]> {
  const response = await serviceRequest(scope === "blocklist" ? "ListBlocklist" : "ListWhitelist");
  return Array.isArray(response.data) ? response.data.filter((entry): entry is DomainEntry => isRecord(entry) && typeof entry.id === "number" && typeof entry.domain === "string") : [];
}

async function reconcileList(scope: SyncScope, remote: DomainEntry[]): Promise<void> {
  const local = await getLocal<DomainEntry[]>(scope, []);
  const baseline = await getLocal<{ blocklist: string[]; whitelist: string[] } | null>("desktop_sync_baseline", null);
  const tombstones = await getLocal<{ scope: SyncScope; domain: string }[]>("desktop_sync_tombstones", []);
  const removed = new Set(tombstones.filter((entry) => entry.scope === scope).map((entry) => entry.domain));
  const remoteByDomain = new Map(remote.map((entry) => [entry.domain, entry]));
  for (const domain of removed) {
    const entry = remoteByDomain.get(domain);
    if (entry) await serviceRequest(scope === "blocklist" ? "RemoveBlocklist" : "RemoveWhitelist", { id: entry.id });
    remoteByDomain.delete(domain);
  }
  const localByDomain = new Map(local.map((entry) => [entry.domain, entry]));
  const baselineDomains = new Set(baseline?.[scope] ?? []);
  const nextLocal = [...local];
  for (const [domain] of remoteByDomain) {
    if (!localByDomain.has(domain) && !removed.has(domain)) nextLocal.push({ id: Date.now() + nextLocal.length, domain });
  }
  for (const entry of [...nextLocal]) {
    if (removed.has(entry.domain)) continue;
    if (!remoteByDomain.has(entry.domain)) {
      if (baselineDomains.has(entry.domain)) {
        const index = nextLocal.findIndex((item) => item.domain === entry.domain);
        if (index >= 0) nextLocal.splice(index, 1);
      } else {
        await serviceRequest(scope === "blocklist" ? "AddBlocklist" : "AddWhitelist", { domain: entry.domain });
        remoteByDomain.set(entry.domain, { id: entry.id, domain: entry.domain });
      }
    }
  }
  await setLocal(scope, nextLocal.filter((entry) => !removed.has(entry.domain)));
  const latest = await getLocal<{ blocklist: string[]; whitelist: string[] } | null>("desktop_sync_baseline", null);
  await setLocal("desktop_sync_baseline", { blocklist: scope === "blocklist" ? [...remoteByDomain.keys()] : latest?.blocklist ?? [], whitelist: scope === "whitelist" ? [...remoteByDomain.keys()] : latest?.whitelist ?? [] });
  await setLocal("desktop_sync_tombstones", tombstones.filter((entry) => entry.scope !== scope));
}

async function syncDesktop(): Promise<boolean> {
  try {
    const rawPolicy = await chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, { type: "get-active-policy" });
    const policy = parseDesktopPolicy(rawPolicy);
    if (!policy || policy.error) throw new Error("Desktop policy unavailable.");
    if (!policy.active || !policy.mode) {
      await setLocal("desktop_session", null);
    } else {
      const expiresAt = policy.expires_at ? new Date(policy.expires_at).getTime() : Date.now() + 86_400_000;
      const existing = await getLocal<Session | null>("desktop_session", null);
      const id = `desktop-${policy.expires_at ?? policy.mode}`;
      const desktop: Session = existing?.id === id
        ? { ...existing, mode: policy.mode, blocklist_snapshot: [...policy.blocklist, ...policy.blocked_domains], whitelist_snapshot: [...policy.whitelist, ...policy.allowed_domains] }
        : { id, mode: policy.mode, started_at: new Date().toISOString(), planned_duration_sec: Math.max(1, Math.ceil((expiresAt - Date.now()) / 1_000)), status: "active", blocklist_snapshot: [...policy.blocklist, ...policy.blocked_domains], whitelist_snapshot: [...policy.whitelist, ...policy.allowed_domains] };
      await setLocal("desktop_session", desktop);
    }
    await reconcileList("blocklist", await remoteList("blocklist"));
    await reconcileList("whitelist", await remoteList("whitelist"));
    if (!await getLocal<boolean>("desktop_sync_paired", false)) {
      await setLocal("desktop_sync_notice", "Lists synced.");
    }
    await setLocal("desktop_sync_paired", true);
    await applyBlockingState();
    return true;
  } catch {
    // Native host absent is expected for standalone extension installs.
    return false;
  }
}

function isSyncMessage(value: unknown): value is BrowserSyncMessage {
  return isRecord(value) && value.type === "focusblock-browser-sync" && (value.reason === "refresh" || value.reason === "list-change");
}

async function initialize(): Promise<void> {
  await chrome.alarms.create(ALARM_DESKTOP_SYNC, { periodInMinutes: 0.5 });
  await applyBlockingState();
  await syncDesktop();
}

chrome.runtime.onInstalled.addListener(() => { void initialize().catch(console.error); });
chrome.runtime.onStartup.addListener(() => { void initialize().catch(console.error); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && ["active_session", "desktop_session", "blocklist", "whitelist", "temporary_allowlist", "schedules", "schedule_suppressed_until"].some((key) => key in changes)) {
    void applyBlockingState().catch(console.error);
  }
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_DESKTOP_SYNC) void syncDesktop();
  else if ([ALARM_SESSION_EXPIRY, ALARM_SCHEDULE_BOUNDARY, ALARM_TEMP_ALLOW_EXPIRY].includes(alarm.name)) void applyBlockingState().catch(console.error);
});
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id && sender.id !== chrome.runtime.id) return;
  if (!isSyncMessage(message)) return;
  void syncDesktop().then((paired) => sendResponse({ paired })).catch(() => sendResponse({ paired: false }));
  return true;
});

void initialize().catch(console.error);
