import { FormEvent, useEffect, useState } from "react";
import { CalendarDots, Clock, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { ipc, Schedule as ScheduleType, SessionMode } from "../lib/ipc";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];
const DAY_OPTIONS = [
  { value: 0, short: "S", label: "Sunday" },
  { value: 1, short: "M", label: "Monday" },
  { value: 2, short: "T", label: "Tuesday" },
  { value: 3, short: "W", label: "Wednesday" },
  { value: 4, short: "T", label: "Thursday" },
  { value: 5, short: "F", label: "Friday" },
  { value: 6, short: "S", label: "Saturday" },
];

function modeLabel(mode: SessionMode) {
  return mode === "lockdown" ? "Lockdown Mode" : "Focus Mode";
}

function modeColor(mode: SessionMode) {
  return mode === "lockdown" ? "var(--color-pulse)" : "var(--color-fathom)";
}

function displayTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameDays(first: number[], second: number[]) {
  return first.length === second.length && first.every((day, index) => day === second[index]);
}

function daySummary(days: number[]) {
  const sorted = [...days].sort((a, b) => a - b);
  if (sameDays(sorted, ALL_DAYS)) return "Every day";
  if (sameDays(sorted, WEEKDAYS)) return "Weekdays";
  if (sameDays(sorted, WEEKENDS)) return "Weekends";
  return sorted.map((day) => DAY_OPTIONS[day].label.slice(0, 3)).join(", ");
}

function endSummary(endsOn: string | null) {
  if (!endsOn) return "Never ends";
  return `Until ${new Date(`${endsOn}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export default function Schedule() {
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [mode, setMode] = useState<SessionMode>("blocklist");
  const [days, setDays] = useState<number[]>(WEEKDAYS);
  const [endMode, setEndMode] = useState<"never" | "on">("never");
  const [endsOn, setEndsOn] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSchedules = async () => {
    try {
      setSchedules(await ipc.getSchedules());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load schedules.");
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const resetForm = () => {
    setStartTime("09:00");
    setEndTime("10:00");
    setMode("blocklist");
    setDays(WEEKDAYS);
    setEndMode("never");
    setEndsOn("");
    setEditingId(null);
    setError(null);
  };

  const toggleDay = (day: number) => {
    setDays((current) => current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort((a, b) => a - b));
  };

  const saveSchedule = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const finalEndDate = endMode === "on" ? endsOn || null : null;
      if (editingId) {
        await ipc.updateSchedule(editingId, startTime, endTime, mode, days, finalEndDate);
      } else {
        await ipc.createSchedule(startTime, endTime, mode, days, finalEndDate);
      }
      resetForm();
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save schedule.");
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (schedule: ScheduleType) => {
    setEditingId(schedule.id);
    setStartTime(schedule.start_time);
    setEndTime(schedule.end_time);
    setMode(schedule.mode);
    setDays(schedule.days_of_week);
    setEndMode(schedule.ends_on ? "on" : "never");
    setEndsOn(schedule.ends_on ?? "");
    setError(null);
  };

  const removeSchedule = async (id: string) => {
    setError(null);
    try {
      await ipc.deleteSchedule(id);
      if (editingId === id) resetForm();
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete schedule.");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "380px" }}>
      <div style={{ marginBottom: "16px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-vast)", margin: 0, letterSpacing: "-0.3px" }}>
          Schedule
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-neutral-500)", lineHeight: 1.45 }}>
          Repeat focus blocks on days that fit your week.
        </p>
      </div>

      <form onSubmit={saveSchedule} style={formStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-vast)" }}>
            {editingId ? "Edit focus block" : "New focus block"}
          </span>
          {editingId && (
            <button type="button" onClick={resetForm} style={quietButtonStyle} aria-label="Cancel editing schedule">
              <X size={15} weight="bold" />
              Cancel
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
          <label style={labelStyle}>
            Start time
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required style={inputStyle} />
          </label>
          <label style={labelStyle}>
            End time
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required style={inputStyle} />
          </label>
        </div>

        <label style={{ ...labelStyle, marginBottom: "12px" }}>
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as SessionMode)} style={inputStyle}>
            <option value="blocklist">Focus Mode</option>
            <option value="lockdown">Lockdown Mode</option>
          </select>
        </label>

        <div style={{ marginBottom: "12px" }}>
          <div style={sectionLabelStyle}>Repeats on</div>
          <div style={{ display: "flex", gap: "5px", marginBottom: "8px" }}>
            {[{ label: "Every day", values: ALL_DAYS }, { label: "Weekdays", values: WEEKDAYS }, { label: "Weekends", values: WEEKENDS }].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDays(preset.values)}
                aria-pressed={sameDays([...days].sort((a, b) => a - b), preset.values)}
                style={{ ...presetButtonStyle, background: sameDays([...days].sort((a, b) => a - b), preset.values) ? "var(--color-dawn)" : "var(--color-lumen)", borderColor: sameDays([...days].sort((a, b) => a - b), preset.values) ? "var(--color-vast)" : "var(--color-lumen-dark)" }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px" }}>
            {DAY_OPTIONS.map((day) => {
              const selected = days.includes(day.value);
              return (
                <button
                  key={day.label}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  aria-pressed={selected}
                  aria-label={day.label}
                  title={day.label}
                  style={{ ...dayButtonStyle, background: selected ? "var(--color-fathom)" : "var(--color-lumen)", color: selected ? "var(--color-lumen)" : "var(--color-vast)", borderColor: selected ? "var(--color-fathom)" : "var(--color-lumen-dark)" }}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <div style={sectionLabelStyle}>Ends</div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button type="button" onClick={() => setEndMode("never")} aria-pressed={endMode === "never"} style={{ ...presetButtonStyle, background: endMode === "never" ? "var(--color-dawn)" : "var(--color-lumen)", borderColor: endMode === "never" ? "var(--color-vast)" : "var(--color-lumen-dark)" }}>Never</button>
            <button type="button" onClick={() => setEndMode("on")} aria-pressed={endMode === "on"} style={{ ...presetButtonStyle, background: endMode === "on" ? "var(--color-dawn)" : "var(--color-lumen)", borderColor: endMode === "on" ? "var(--color-vast)" : "var(--color-lumen-dark)" }}>On date</button>
            {endMode === "on" && <input type="date" value={endsOn} min={localDateKey()} onChange={(e) => setEndsOn(e.target.value)} required style={{ ...inputStyle, flex: 1, minWidth: 0 }} />}
          </div>
        </div>

        {error && <div role="alert" style={errorStyle}>{error}</div>}

        <button type="submit" disabled={saving} style={{ ...primaryButtonStyle, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {editingId ? <PencilSimple size={15} weight="bold" /> : <Plus size={15} weight="bold" />}
          {editingId ? "Save changes" : "Add schedule"}
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        {schedules.map((schedule) => (
          <div key={schedule.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "11px 12px", background: "var(--color-surface)", border: "1px solid var(--color-lumen-dark)", borderRadius: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: schedule.mode === "lockdown" ? "#fff1f0" : "var(--color-accent-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CalendarDots size={15} color={modeColor(schedule.mode)} weight="fill" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", fontWeight: 600, color: "var(--color-vast)" }}>
                  <Clock size={13} color="var(--color-neutral-400)" />
                  {displayTime(schedule.start_time)} – {displayTime(schedule.end_time)}
                </div>
                <div style={{ marginTop: "3px", fontSize: "11px", color: "var(--color-neutral-500)", lineHeight: 1.35 }}>
                  {daySummary(schedule.days_of_week)} · {endSummary(schedule.ends_on)}
                </div>
                <div style={{ marginTop: "2px", fontSize: "11px", color: modeColor(schedule.mode), fontWeight: 600 }}>
                  {modeLabel(schedule.mode)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <button type="button" onClick={() => beginEdit(schedule)} aria-label={`Edit ${schedule.start_time} schedule`} style={iconButtonStyle}>
                <PencilSimple size={15} />
              </button>
              <button type="button" onClick={() => removeSchedule(schedule.id)} aria-label={`Delete ${schedule.start_time} schedule`} style={iconButtonStyle}>
                <Trash size={15} />
              </button>
            </div>
          </div>
        ))}

        {schedules.length === 0 && (
          <div style={{ textAlign: "center", padding: "28px 0", color: "var(--color-neutral-400)", fontSize: "13px" }}>
            No schedules yet. Your first focus block can repeat every week.
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = { display: "flex", flexDirection: "column" as const, gap: "5px", fontSize: "11px", color: "var(--color-neutral-500)", fontWeight: 600 };
const sectionLabelStyle = { marginBottom: "6px", fontSize: "11px", color: "var(--color-neutral-500)", fontWeight: 600 };
const inputStyle = { width: "100%", padding: "9px 10px", border: "1px solid var(--color-lumen-dark)", borderRadius: "8px", background: "var(--color-lumen)", color: "var(--color-vast)", fontFamily: "var(--font-sans)", fontSize: "13px", outline: "none", boxSizing: "border-box" as const };
const formStyle = { background: "var(--color-surface)", border: "1px solid var(--color-lumen-dark)", borderRadius: "14px", padding: "14px", marginBottom: "16px" };
const presetButtonStyle = { border: "1px solid var(--color-lumen-dark)", borderRadius: "8px", color: "var(--color-vast)", padding: "6px 8px", fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" as const };
const dayButtonStyle = { height: "29px", border: "1px solid var(--color-lumen-dark)", borderRadius: "8px", fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, cursor: "pointer" };
const primaryButtonStyle = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px 14px", border: "none", borderRadius: "100px", background: "var(--color-vast)", color: "var(--color-lumen)", fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600 };
const quietButtonStyle = { display: "inline-flex", alignItems: "center", gap: "3px", border: "none", background: "transparent", color: "var(--color-neutral-500)", fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 600, cursor: "pointer", padding: "3px" };
const iconButtonStyle = { display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", border: "none", borderRadius: "7px", background: "transparent", color: "var(--color-neutral-400)", cursor: "pointer" };
const errorStyle = { marginBottom: "10px", padding: "9px 10px", borderRadius: "8px", background: "var(--color-pulse-soft)", color: "var(--color-pulse)", fontSize: "12px", lineHeight: 1.35 };
