/**
 * Typed chrome.storage.local adapter.
 * Mirrors the shape used by the desktop app's localStorage mock so that
 * all page components and IPC logic work identically.
 */

export interface ScheduleRecord {
  id: string;
  start_time: string;
  end_time: string;
  mode: "blocklist" | "lockdown";
  /** JavaScript weekday numbers: Sunday = 0 through Saturday = 6. */
  days_of_week: number[];
  /** Local calendar date (`YYYY-MM-DD`) of the final occurrence, or never. */
  ends_on: string | null;
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
  blocklist: { id: number; domain: string }[];
  whitelist: { id: number; domain: string }[];
  temporary_allowlist: { id: string; domain: string; expires_at: number }[];
  presets: {
    id: string;
    name: string;
    mode: "blocklist" | "lockdown";
    duration_minutes: number;
    blocklist: string[];
    whitelist: string[];
  }[];
  schedules: ScheduleRecord[];
  active_session: {
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
  } | null;
  history: {
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
  }[];
  schedule_suppressed_until: number | null;
  active_challenge: {
    type: string;
    status: "pending" | "passed";
  } | null;
  settings: {
    os_allowlist_enabled: boolean;
    stop_challenge: string;
    challenge_countdown_duration: number;
    challenge_countdown_breathing: boolean;
  };
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

  return (val !== undefined ? val : DEFAULTS[key]) as StorageData[K];
}

/** Set one key in chrome.storage.local. */
export async function storageSet<K extends keyof StorageData>(
  key: K,
  value: StorageData[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}
