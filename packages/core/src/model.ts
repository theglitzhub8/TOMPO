export type Mode = "Gentle" | "Firm" | "Strict";
export type Task = {
  id: string;
  title: string;
  projectId: string | null;
  duration: number;
  status: "pending" | "completed";
  scheduledAt: string | null;
  completedAt: string | null;
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
};
export type EntityMap = {
  task: Task;
  project: Project;
  routine: Routine;
  preferences: Preferences;
};
export const defaults: Preferences = {
  timezone: "Asia/Shanghai",
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
    if (
      !["pending", "completed"].includes(t.status) ||
      [t.scheduledAt, t.completedAt].some(
        (d) => d !== null && !Number.isFinite(Date.parse(d)),
      )
    )
      throw new Error("Invalid task status or date");
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
