/**
 * Typed chrome.storage.local adapter.
 * Mirrors the shape used by the desktop app's localStorage mock so that
 * all page components and IPC logic work identically.
 *
 * This module OWNS the stored-entity shapes; ipc.ts re-exports them so
 * components keep importing from one place.
 */

export type SessionMode = "blocklist" | "lockdown";
export type SessionStatus = "active" | "completed" | "stopped";

export interface DomainListEntry {
  id: number;
  domain: string;
}

export interface ScheduleRecord {
  id: string;
  start_time: string;
  end_time: string;
  mode: SessionMode;
  /** JavaScript weekday numbers: Sunday = 0 through Saturday = 6. */
  days_of_week: number[];
  /** Local calendar date (`YYYY-MM-DD`) of the final occurrence, or never. */
  ends_on: string | null;
}

/**
 * A live session occupying the active slot. `ended_at` is always null while
 * a session is running; anything else in the slot is a stray from a partial
 * write and must be migrated (see the reader below).
 */
export interface ActiveSessionRecord extends SessionBase {
  status: "active";
  ended_at: null;
}

/** Why an archived session finished. Expire completes; stop/supersede stop. */
export type ArchivedOutcome = "completed" | "stopped";

/** A finished session, as stored in history. `ended_at` always recorded. */
export interface ArchivedSessionRecord extends SessionBase {
  status: ArchivedOutcome;
  ended_at: string;
}

interface SessionBase {
  id: string;
  preset_id: string | null;
  mode: SessionMode;
  started_at: string;
  planned_duration_sec: number;
  blocklist_snapshot: string[];
  whitelist_snapshot: string[];
  scheduled_schedule_id?: string | null;
}

/** Any session record, live or archived. */
export type SessionRecord = ActiveSessionRecord | ArchivedSessionRecord;

export interface PresetRecord {
  id: string;
  name: string;
  mode: SessionMode;
  duration_minutes: number;
  blocklist: string[];
  whitelist: string[];
}

export interface TemporaryAllowRecord {
  id: string;
  domain: string;
  expires_at: number;
}

export interface ChallengeRecord {
  type: string;
  status: "pending" | "passed";
}

export interface SettingsRecord {
  os_allowlist_enabled: boolean;
  stop_challenge: string;
  challenge_countdown_duration: number;
  challenge_countdown_breathing: boolean;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function normalizeSchedule(record: unknown): ScheduleRecord {
  const schedule = record as Partial<ScheduleRecord>;
  const days = Array.isArray(schedule.days_of_week)
    ? [...new Set(schedule.days_of_week.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b)
    : [];

  return {
    id: String(schedule.id ?? ""),
    start_time: String(schedule.start_time ?? ""),
    end_time: String(schedule.end_time ?? ""),
    mode: schedule.mode === "lockdown" ? "lockdown" : "blocklist",
    // Schedules saved before recurrence existed repeated every day.
    days_of_week: days.length > 0 ? days : ALL_DAYS,
    ends_on: typeof schedule.ends_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(schedule.ends_on)
      ? schedule.ends_on
      : null,
  };
}

export interface StorageData {
  blocklist: DomainListEntry[];
  whitelist: DomainListEntry[];
  temporary_allowlist: TemporaryAllowRecord[];
  presets: PresetRecord[];
  schedules: ScheduleRecord[];
  active_session: ActiveSessionRecord | null;
  history: ArchivedSessionRecord[];
  schedule_suppressed_until: number | null;
  active_challenge: ChallengeRecord | null;
  settings: SettingsRecord;
}

const DEFAULTS: StorageData = {
  blocklist: [],
  whitelist: [],
  temporary_allowlist: [],
  presets: [],
  schedules: [],
  active_session: null,
  history: [],
  schedule_suppressed_until: null,
  active_challenge: null,
  settings: {
    os_allowlist_enabled: false,
    stop_challenge: "none",
    challenge_countdown_duration: 30,
    challenge_countdown_breathing: false,
  },
};

/** Get one key from chrome.storage.local with a typed default. */
export async function storageGet<K extends keyof StorageData>(
  key: K
): Promise<StorageData[K]> {
  const result = await chrome.storage.local.get(key);
  const val = result[key];

  if (key === "schedules" && Array.isArray(val)) {
    const schedules = val.map(normalizeSchedule);
    if (JSON.stringify(schedules) !== JSON.stringify(val)) {
      await chrome.storage.local.set({ schedules });
    }
    return schedules as StorageData[K];
  }

  // A terminal-status record in the active slot is a stray from a partial
  // write. The service worker owns migrating it into history on its next
  // apply; readers here just refuse to treat it as live.
  if (key === "active_session" && val !== undefined && val !== null) {
    const candidate = val as Partial<SessionRecord>;
    if (candidate.status !== "active") {
      return null as StorageData[typeof key];
    }
    return { ...(candidate as ActiveSessionRecord), ended_at: null } as StorageData[typeof key];
  }

  return (val !== undefined ? val : DEFAULTS[key]) as StorageData[K];
}

/** Set one key in chrome.storage.local. */
export async function storageSet<K extends keyof StorageData>(
  key: K,
  value: StorageData[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}
