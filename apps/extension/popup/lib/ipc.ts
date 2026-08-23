/**
 * Extension IPC layer.
 *
 * Drop-in replacement for the desktop's ipc.ts. All method signatures are
 * identical so page components import this without any changes.
 *
 * Instead of Tauri invoke / localStorage mock, this reads and writes
 * chrome.storage.local and notifies the service worker of changes via storage
 * events (the service worker listens to chrome.storage.onChanged).
 */

import {
  storageGet,
  storageSet,
  ScheduleRecord,
  SessionRecord,
  PresetRecord,
  TemporaryAllowRecord,
  SettingsRecord,
} from "./storage";

// ── Types ────────────────────────────────────────────────────────────────────
//
// Stored-entity shapes are owned by ./storage and re-exported here under the
// names components already import. No second hand-written declaration.

export type SessionMode = "blocklist" | "lockdown";
export type SessionStatus = "active" | "completed" | "stopped";

export type Session = SessionRecord;
export type Preset = PresetRecord;
export type TemporaryAllowEntry = TemporaryAllowRecord;
export type AppSettings = SettingsRecord;
export interface Schedule extends ScheduleRecord {}

export interface ActiveSessionView {
  session: Session;
  elapsed_sec: number;
  remaining_sec: number | null;
}

export interface ActiveChallengeView {
  type: string;
  status: "pending" | "passed";
}

export interface DomainEntry {
  id: number;
  domain: string;
}

export interface ServiceHealth {
  running: boolean;
  version: string;
}

export interface ServiceStatus {
  health: ServiceHealth;
  active_session: ActiveSessionView | null;
  active_challenge: ActiveChallengeView | null;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function parseTime(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDays(days: number[]): number[] {
  return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
}

function dateRangesOverlap(firstEndsOn: string | null, secondEndsOn: string | null): boolean {
  const today = localDateKey();
  return (firstEndsOn === null || firstEndsOn >= today) && (secondEndsOn === null || secondEndsOn >= today);
}

function validateSchedule(
  startTime: string,
  endTime: string,
  daysOfWeek: number[],
  endsOn: string | null,
  existingSchedules: Schedule[],
  excludedId?: string
): { days: number[]; endsOn: string | null } {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (start === null || end === null) throw new Error("Enter valid start and end times.");
  if (start >= end) throw new Error("End time must be after start time.");

  const days = normalizeDays(daysOfWeek);
  if (days.length === 0) throw new Error("Choose at least one day.");

  if (endsOn !== null) {
    if (!isDateKey(endsOn)) throw new Error("Choose a valid end date.");
    if (endsOn < localDateKey()) throw new Error("End date cannot be in the past.");
  }

  const overlap = existingSchedules.find((schedule) => {
    if (schedule.id === excludedId) return false;
    const existingStart = parseTime(schedule.start_time);
    const existingEnd = parseTime(schedule.end_time);
    return (
      existingStart !== null &&
      existingEnd !== null &&
      start < existingEnd &&
      end > existingStart &&
      schedule.days_of_week.some((day) => days.includes(day)) &&
      dateRangesOverlap(schedule.ends_on, endsOn)
    );
  });

  if (overlap) {
    throw new Error(`Schedule overlaps with ${overlap.start_time}–${overlap.end_time} on one or more selected days.`);
  }

  return { days, endsOn };
}

// ── Domain normalization (extension-hardened variant of the desktop copy) ───
//
// The extension turns every accepted entry into a DNR regexFilter/urlFilter.
// Regex metacharacters that reach a regexFilter make updateDynamicRules throw,
// which silently stops all blocking updates, so anything outside the safe
// charset is rejected here before it is ever stored.

/** Characters allowed inside a stored domain or wildcard match text. */
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

export function normalizeDomain(input: string): string | null {
  let str = input.trim().toLowerCase();
  if (!str) return null;

  if (str.startsWith("*")) {
    const matchText = str.slice(1).trim();
    if (!isValidStoredDomain(`*${matchText}`)) {
      return null;
    }
    return `*${matchText}`;
  }

  if (str.startsWith("http://")) {
    str = str.slice(7);
  } else if (str.startsWith("https://")) {
    str = str.slice(8);
  }

  const slashIndex = str.indexOf("/");
  if (slashIndex !== -1) str = str.slice(0, slashIndex);

  const queryIndex = str.indexOf("?");
  if (queryIndex !== -1) str = str.slice(0, queryIndex);

  const hashIndex = str.indexOf("#");
  if (hashIndex !== -1) str = str.slice(0, hashIndex);

  const colonIndex = str.indexOf(":");
  if (colonIndex !== -1) str = str.slice(0, colonIndex);

  if (str.startsWith("www.")) str = str.slice(4);

  if (!isValidStoredDomain(str)) return null;

  return str;
}

// ── Background channel ───────────────────────────────────────────────────────
//
// Session lifecycle mutations run in the service worker under its mutation
// lock. Sending them as messages means rapid clicks and expiry alarms
// serialize instead of racing read-modify-write updates on chrome.storage.

interface BackgroundResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export type BridgeFailureKind = "app" | "unavailable";

export interface BridgeFailure {
  kind: BridgeFailureKind;
  message: string;
}

export type BridgeEnvelope<T> = { ok: true; data: T } | ({ ok: false } & BridgeFailure);

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function sendToBackground<T>(message: Record<string, unknown>): Promise<BridgeEnvelope<T>> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response: BackgroundResponse | undefined) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          resolve({
            ok: false,
            kind: "unavailable",
            message: lastError.message ?? "Background service unreachable",
          });
          return;
        }
        if (!response || typeof response !== "object" || typeof response.ok !== "boolean") {
          resolve({ ok: false, kind: "unavailable", message: "Background service did not respond" });
          return;
        }
        if (!response.ok) {
          const failure: BridgeFailure = {
            kind: "app",
            message: response.error ?? "Unknown background error",
          };
          resolve({ ok: false, ...failure });
          return;
        }
        resolve({ ok: true, data: response.result as T });
      });
    } catch (error) {
      resolve({ ok: false, kind: "unavailable", message: errorMessage(error) });
    }
  });
}

/** Turn an envelope into a plain promise; the error carries its kind. */
function unwrap<T>(envelope: BridgeEnvelope<T>): Promise<T> {
  if (envelope.ok) return Promise.resolve(envelope.data);
  const error = new Error(envelope.message) as Error & { kind?: BridgeFailureKind };
  error.kind = envelope.kind;
  return Promise.reject(error);
}

// ── IPC implementation ───────────────────────────────────────────────────────

export const ipc = {
  // Health / status ──────────────────────────────────────────────────────────

  ping: async (): Promise<null> => null,

  getHealth: async (): Promise<ServiceHealth> => ({
    running: true,
    version: chrome.runtime.getManifest().version,
  }),

  getStatus: async (): Promise<ServiceStatus> => {
    // Let the service worker finalize any due session under its mutation lock
    // before reading; if it cannot be reached, degrade to a read-only view.
    await sendToBackground<null>({ type: "session:expire" });

    const activeSession = await storageGet("active_session");
    const activeChallenge = await storageGet("active_challenge");

    return {
      health: { running: true, version: chrome.runtime.getManifest().version },
      active_session:
        activeSession && activeSession.status === "active"
          ? {
              session: activeSession,
              elapsed_sec: Math.floor(
                (Date.now() -
                  new Date(activeSession.started_at).getTime()) /
                  1000
              ),
              remaining_sec: Math.max(
                0,
                activeSession.planned_duration_sec -
                  Math.floor(
                    (Date.now() -
                      new Date(activeSession.started_at).getTime()) /
                      1000
                  )
              ),
            }
          : null,
      active_challenge: activeChallenge,
    };
  },

  // Blocklist ────────────────────────────────────────────────────────────────

  listBlocklist: async (): Promise<DomainEntry[]> => storageGet("blocklist"),

  addBlocklist: async (domain: string): Promise<number> => {
    const norm = normalizeDomain(domain);
    if (!norm) throw new Error("Invalid site. Use letters, numbers, dots, hyphens, or a leading * wildcard (for example, *game).");

    const list = await storageGet("blocklist");
    if (list.some((d) => d.domain === norm)) {
      throw new Error("Domain already in blocklist");
    }
    const id = Date.now();
    list.push({ id, domain: norm });
    await storageSet("blocklist", list);
    return id;
  },

  removeBlocklist: async (id: number): Promise<null> => {
    let list = await storageGet("blocklist");
    list = list.filter((d) => d.id !== id);
    await storageSet("blocklist", list);
    return null;
  },

  // Whitelist ────────────────────────────────────────────────────────────────

  listWhitelist: async (): Promise<DomainEntry[]> => storageGet("whitelist"),

  addWhitelist: async (domain: string): Promise<number> => {
    const norm = normalizeDomain(domain);
    if (!norm) throw new Error("Invalid site. Use letters, numbers, dots, hyphens, or a leading * wildcard (for example, *game).");

    const list = await storageGet("whitelist");
    if (list.some((d) => d.domain === norm)) {
      throw new Error("Domain already in whitelist");
    }
    const id = Date.now();
    list.push({ id, domain: norm });
    await storageSet("whitelist", list);
    return id;
  },

  removeWhitelist: async (id: number): Promise<null> => {
    let list = await storageGet("whitelist");
    list = list.filter((d) => d.id !== id);
    await storageSet("whitelist", list);
    return null;
  },

  // Temporary allowlist â€” persists locally until its expiry timestamp.
  listTemporaryAllows: async (): Promise<TemporaryAllowEntry[]> => {
    const entries = await storageGet("temporary_allowlist");
    const now = Date.now();
    const active = entries.filter((entry) =>
      typeof entry?.id === "string" &&
      typeof entry.domain === "string" &&
      typeof entry.expires_at === "number" &&
      entry.expires_at > now
    );
    if (active.length !== entries.length) {
      await storageSet("temporary_allowlist", active);
    }
    return active;
  },

  addTemporaryAllow: async (domain: string, durationMinutes: number): Promise<TemporaryAllowEntry> => {
    const norm = normalizeDomain(domain);
    if (!norm) throw new Error("Enter a valid site or wildcard such as *game");    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new Error("Choose a valid duration");
    }

    const active = await ipc.listTemporaryAllows();
    const entry: TemporaryAllowEntry = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      domain: norm,
      expires_at: Date.now() + durationMinutes * 60 * 1000,
    };
    await storageSet("temporary_allowlist", [...active, entry]);
    return entry;
  },

  removeTemporaryAllow: async (id: string): Promise<null> => {
    const entries = await storageGet("temporary_allowlist");
    await storageSet("temporary_allowlist", entries.filter((entry) => entry.id !== id));
    return null;
  },


  // Sessions & Challenges ────────────────────────────────────────────────────

  getSchedules: async (): Promise<Schedule[]> => storageGet("schedules"),

  createSchedule: async (
    start_time: string,
    end_time: string,
    mode: SessionMode,
    days_of_week: number[] = ALL_DAYS,
    ends_on: string | null = null
  ): Promise<Schedule> => {
    const schedules = await storageGet("schedules");
    const { days, endsOn } = validateSchedule(start_time, end_time, days_of_week, ends_on, schedules);

    const schedule: Schedule = {
      id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      start_time,
      end_time,
      mode,
      days_of_week: days,
      ends_on: endsOn,
    };
    await storageSet("schedules", [...schedules, schedule]);
    return schedule;
  },

  updateSchedule: async (
    id: string,
    start_time: string,
    end_time: string,
    mode: SessionMode,
    days_of_week: number[],
    ends_on: string | null
  ): Promise<Schedule> => {
    const schedules = await storageGet("schedules");
    if (!schedules.some((schedule) => schedule.id === id)) throw new Error("Schedule no longer exists.");
    const { days, endsOn } = validateSchedule(start_time, end_time, days_of_week, ends_on, schedules, id);
    const updated: Schedule = { id, start_time, end_time, mode, days_of_week: days, ends_on: endsOn };
    await storageSet("schedules", schedules.map((schedule) => schedule.id === id ? updated : schedule));
    return updated;
  },

  deleteSchedule: async (id: string): Promise<null> => {
    const schedules = await storageGet("schedules");
    await storageSet(
      "schedules",
      schedules.filter((schedule) => schedule.id !== id)
    );
    return null;
  },

  startChallenge: async (type: string): Promise<null> => {
    await storageSet("active_challenge", { type, status: "pending" });
    return null;
  },

  cancelChallenge: async (): Promise<null> => {
    await storageSet("active_challenge", null);
    return null;
  },

  startSession: async (
    mode: SessionMode,
    duration_minutes: number,
    preset_id?: string
  ): Promise<null> => {
    const envelope = await sendToBackground<null>({
      type: "session:start",
      mode,
      duration_minutes,
      preset_id,
    });
    return unwrap(envelope);
  },

  stopSession: async (): Promise<null> => {
    const envelope = await sendToBackground<null>({ type: "session:stop" });
    return unwrap(envelope);
  },

  /**
   * Envelope-returning status probe, mirroring the desktop ipc so both
   * layers keep identical signatures. In the extension the background
   * service always exists; a failure surfaces as an arm instead of a throw.
   */
  getStatusSafe: async (): Promise<BridgeEnvelope<ServiceStatus>> => {
    try {
      return { ok: true, data: await ipc.getStatus() };
    } catch (e) {
      const error = e as Error & { kind?: BridgeFailureKind };
      return { ok: false, kind: error.kind ?? "unavailable", message: errorMessage(e) };
    }
  },

  // History ──────────────────────────────────────────────────────────────────

  listHistory: async (limit: number = 50): Promise<Session[]> => {
    const history = await storageGet("history");
    return history.slice(0, limit);
  },

  clearHistory: async (): Promise<null> => {
    await storageSet("history", []);
    return null;
  },

  // Settings ─────────────────────────────────────────────────────────────────

  getSettings: async (): Promise<AppSettings> => storageGet("settings"),

  updateSettings: async (settings: AppSettings): Promise<null> => {
    await storageSet("settings", settings);
    return null;
  },
};
