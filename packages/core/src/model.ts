export type Mode = "Gentle" | "Firm" | "Strict";
export type Task = {
  id: string;
  title: string;
  projectId: string | null;
  duration: number;
  status: "pending" | "completed";
  scheduledAt: string | null;
  completedAt: string | null;
  fixed?: boolean;
  steps?: string[];
  plannedDay?: string;
  dueDay?: string;
  priority?: "low" | "normal" | "high";
  startedAt?: string | null;
  recurrence?: { days: number[]; startDay: string; skippedDays?: string[] };
  seriesId?: string;
  occurrenceDay?: string;
  carriedFrom?: string[];
};
export type Project = { id: string; title: string };
export type Routine = {
  id: string;
  title: string;
  start: string;
  duration: number;
  days: number[];
  protected: true;
};
export type Preferences = {
  timezone: string;
  mode: Mode;
  quietStart: string;
  quietEnd: string;
  onboardingComplete: boolean;
  dayEnd?: string;
};
export type EntityMap = {
  task: Task;
  project: Project;
  routine: Routine;
  preferences: Preferences;
};
// New accounts start on the device's own clock, falling back to UTC.
const deviceZone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();
export const defaults: Preferences = {
  timezone: deviceZone,
  mode: "Gentle",
  quietStart: "22:00",
  quietEnd: "07:00",
  onboardingComplete: false,
};
export function validTimezone(zone: string) {
  if (typeof zone !== "string" || !zone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
export function validClock(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function validate(
  kind: keyof EntityMap,
  value: EntityMap[keyof EntityMap],
) {
  if (kind === "preferences") {
    const p = value as Preferences;
    if (
      !validTimezone(p.timezone) ||
      !["Gentle", "Firm", "Strict"].includes(p.mode) ||
      (p.dayEnd !== undefined && !validClock(p.dayEnd)) ||
      !validClock(p.quietStart) ||
      !validClock(p.quietEnd) ||
      typeof p.onboardingComplete !== "boolean"
    )
      throw new Error("Invalid preferences");
    return;
  }
  const v = value as Task | Project | Routine;
  if (!v.id || !v.title?.trim() || v.title.length > 200)
    throw new Error("Enter a title of 1–200 characters");
  if (
    "duration" in v &&
    (!Number.isInteger(v.duration) || v.duration < 1 || v.duration > 1440)
  )
    throw new Error("Duration must be 1–1440 minutes");
  if (kind === "task") {
    const t = value as Task;
    validateTaskLifecycle(t);
    if ((t.dueDay !== undefined && !validDay(t.dueDay)) ||
      (t.priority !== undefined && !["low", "normal", "high"].includes(t.priority)) ||
      (t.startedAt !== undefined && t.startedAt !== null && (typeof t.startedAt !== "string" || !Number.isFinite(Date.parse(t.startedAt)))))
      throw new Error("Check the task deadline, priority, or start time.");
    if (t.recurrence && t.id.length > 99) throw new Error("Recurring task identifier is too long.");
    if (
      !["pending", "completed"].includes(t.status) ||
      [t.scheduledAt, t.completedAt].some(
        (d) => d !== null && !Number.isFinite(Date.parse(d)),
      )
    )
      throw new Error("Invalid task status or date");
    if (
      (t.fixed !== undefined && typeof t.fixed !== "boolean") ||
      (t.steps !== undefined &&
        (!Array.isArray(t.steps) ||
          t.steps.length > 8 ||
          t.steps.some(
            (s) => typeof s !== "string" || !s.trim() || s.length > 200,
          ))) ||
      (t.plannedDay !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(t.plannedDay))
    )
      throw new Error("Invalid planning details");
    if ((t.status === "completed") !== (t.completedAt !== null))
      throw new Error("Completion time must match status");
  }
  if (kind === "routine") {
    const r = value as Routine;
    if (
      !validClock(r.start) ||
      r.protected !== true ||
      !r.days.length ||
      r.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    )
      throw new Error("Invalid recurring routine");
  }
}

export function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Shared by the device and API so cloud round trips retain lifecycle metadata. */
export function validateTaskLifecycle(t: Pick<Task, "recurrence" | "seriesId" | "occurrenceDay" | "carriedFrom">) {
  if (t.recurrence !== undefined && (!t.recurrence ||
    !Array.isArray(t.recurrence.days) || !t.recurrence.days.length || t.recurrence.days.length > 7 ||
    t.recurrence.days.some(d => !Number.isInteger(d) || d < 0 || d > 6) ||
    !validDay(t.recurrence.startDay) ||
    (t.recurrence.skippedDays !== undefined && (!Array.isArray(t.recurrence.skippedDays) ||
      t.recurrence.skippedDays.length > 366 || t.recurrence.skippedDays.some(d => !validDay(d)))))) throw new Error("Choose valid repeat days and a start date.");
  if ((t.seriesId !== undefined && (typeof t.seriesId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,99}$/.test(t.seriesId))) ||
    (t.occurrenceDay !== undefined && !validDay(t.occurrenceDay)) ||
    ((t.seriesId === undefined) !== (t.occurrenceDay === undefined))) throw new Error("Invalid recurring occurrence.");
  if (t.recurrence && t.seriesId) throw new Error("An occurrence cannot create another series.");
  if (t.carriedFrom !== undefined && (!Array.isArray(t.carriedFrom) || t.carriedFrom.length > 366 ||
    t.carriedFrom.some(d => !validDay(d)))) throw new Error("Invalid carry-forward history.");
}
