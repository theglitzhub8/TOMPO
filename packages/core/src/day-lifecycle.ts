import { validDay, validate, type Task, type Routine } from "./model.ts";
import { localInstant, localParts } from "./scheduling.ts";
import { buildDay } from "./day-planner.ts";

export function shiftDay(day: string, offset: number) {
  if (!validDay(day)) throw new Error("Choose a valid date (YYYY-MM-DD).");
  return new Date(Date.parse(`${day}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
}
export function belongsToDay(task: Task, day: string, timezone: string) {
  return task.plannedDay === day || !!(task.scheduledAt && localParts(new Date(task.scheduledAt), timezone).date === day);
}

/** Generate only the coming week, with stable IDs across devices and retries.
 * Each occurrence is independent; old missed occurrences are never backfilled.
 */
export function recurringOccurrences(tasks: Task[], day: string, timezone: string): Task[] {
  if (!validDay(day)) throw new Error("Choose a valid date.");
  const existing = new Set(tasks.map(t => t.id));
  const result: Task[] = [];
  for (const root of tasks.filter(t => t.recurrence)) {
    validate("task", root);
    for (let i = 0; i < 7; i++) {
      const date = shiftDay(day, i);
      const rule = root.recurrence!;
      if (date <= rule.startDay || rule.skippedDays?.includes(date) || !rule.days.includes(new Date(`${date}T12:00:00Z`).getUTCDay())) continue;
      const id = `${root.id}:repeat:${date}`;
      if (existing.has(id)) continue;
      const clock = root.fixed && root.scheduledAt ? localParts(new Date(root.scheduledAt), timezone).clock : null;
      const occurrence: Task = {
        id, title: root.title, projectId: root.projectId, duration: root.duration,
        status: "pending", completedAt: null, fixed: !!clock,
        scheduledAt: clock ? localInstant(date, clock, timezone).toISOString() : null,
        plannedDay: date, steps: root.steps, ...(root.note ? { note: root.note } : {}), seriesId: root.id, occurrenceDay: date,
      };
      validate("task", occurrence);
      existing.add(id);
      result.push(occurrence);
    }
  }
  return result;
}

/** Remember deleted occurrences so the next sync does not recreate them. */
export function skipOccurrences(tasks: Task[], ids: string[]): Task[] {
  const removed = new Set(ids);
  return tasks.filter(t => t.recurrence && !removed.has(t.id)).flatMap(root => {
    const dates = tasks.filter(t => removed.has(t.id) && t.seriesId === root.id).map(t => t.occurrenceDay!);
    if (!dates.length) return [];
    const updated = { ...root, recurrence: { ...root.recurrence!, skippedDays: [...new Set([...(root.recurrence!.skippedDays ?? []), ...dates])] } };
    validate("task", updated);
    return [updated];
  });
}

export function reviseDay(tasks: Task[], routines: Routine[], day: string, timezone: string,
  now: Date, availableFrom: string, end: string) {
  const available = localInstant(day, availableFrom, timezone);
  const finish = localInstant(day, end, timezone);
  const start = new Date(Math.max(now.getTime(), available.getTime()));
  if (finish <= start) throw new Error("Choose a finish time after you’re available.");
  return buildDay(tasks, routines, day, timezone, start, end, true);
}

export function dayReview(tasks: Task[], day: string, timezone: string) {
  if (!validDay(day)) throw new Error("Choose a valid date.");
  const planned = tasks.filter(t => belongsToDay(t, day, timezone) || t.carriedFrom?.includes(day));
  const completed = planned.filter(t => t.completedAt && localParts(new Date(t.completedAt), timezone).date === day);
  const unfinished = planned.filter(t => t.status === "pending" && belongsToDay(t, day, timezone));
  const carried = planned.filter(t => t.carriedFrom?.includes(day));
  return { planned, completed, unfinished, carried,
    minutes: completed.reduce((total, t) => total + t.duration, 0) };
}

/** Move only explicitly selected flexible tasks. Appointments and repeat series stay put. */
export function carryForward(tasks: Task[], ids: string[], day: string, timezone: string): Task[] {
  const selected = new Set(ids);
  const tomorrow = shiftDay(day, 1);
  return tasks.filter(t => selected.has(t.id)).map(t => {
    if (t.status !== "pending" || t.fixed !== false || t.recurrence || t.seriesId || !belongsToDay(t, day, timezone))
      throw new Error("Only unfinished, flexible, non-recurring tasks can be carried forward.");
    const updated: Task = { ...t, plannedDay: tomorrow, scheduledAt: null,
      carriedFrom: [...new Set([...(t.carriedFrom ?? []), day])] };
    validate("task", updated);
    return updated;
  });
}
