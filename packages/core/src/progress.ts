import type { Task } from "./model.ts";
import { localParts } from "./scheduling.ts";

/** A day counts toward the streak when at least this share of its tasks is done. */
export const streakTarget = 0.8;
const shift = (day: string, days: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** The local day a task belongs to: its planned day, else its start. */
export function taskDay(task: Task, timezone: string) {
  if (task.plannedDay) return task.plannedDay;
  return task.scheduledAt ? localParts(new Date(task.scheduledAt), timezone).date : null;
}

export function dayScore(tasks: Task[], day: string, timezone: string) {
  const mine = tasks.filter((t) => taskDay(t, timezone) === day);
  const done = mine.filter((t) => t.status === "completed").length;
  return {
    planned: mine.length,
    done,
    score: mine.length ? Math.round((done / mine.length) * 100) : 0,
    met: mine.length > 0 && done / mine.length >= streakTarget,
  };
}

/**
 * Days in a row that hit the target, counting back from today. Today only adds
 * once it is met; days with nothing planned neither count nor break the run.
 */
export function progress(tasks: Task[], today: string, timezone: string) {
  const byDay = new Map<string, { planned: number; done: number }>();
  for (const t of tasks) {
    const day = taskDay(t, timezone);
    if (!day || day > today) continue;
    const entry = byDay.get(day) ?? { planned: 0, done: 0 };
    entry.planned++;
    if (t.status === "completed") entry.done++;
    byDay.set(day, entry);
  }
  const met = (day: string) => {
    const e = byDay.get(day);
    return e ? e.done / e.planned >= streakTarget : null;
  };
  let streak = met(today) ? 1 : 0;
  for (let day = shift(today, -1), i = 0; i < 366; i++, day = shift(day, -1)) {
    const result = met(day);
    if (result === false) break;
    if (result) streak++;
  }
  const done = tasks.filter((t) => t.status === "completed").length;
  const goodDays = [...byDay.keys()].filter((d) => met(d)).length;
  return { streak, points: done * 10 + goodDays * 50, today: dayScore(tasks, today, timezone) };
}
