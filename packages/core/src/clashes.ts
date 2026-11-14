import { routineOn, type Routine, type Task } from "./model.ts";
import { localInstant, localParts } from "./scheduling.ts";

export type Clash = {
  kind: "routine" | "task";
  id: string;
  title: string;
  /** The date the clashing occurrence belongs to (for skipping a routine once). */
  date: string;
  start: number;
  end: number;
};
export type Slot = { day: string; clock: string; duration: number };
type Context = { routines: Routine[]; tasks: Task[]; timezone: string; ignoreId?: string };

const shift = (day: string, days: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const dow = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** Weekly tasks and fixed appointments that overlap a time. */
export function findClashes(slot: Slot, { routines, tasks, timezone, ignoreId }: Context): Clash[] {
  const start = localInstant(slot.day, slot.clock, timezone).getTime();
  const end = start + slot.duration * 60000;
  const out: Clash[] = [];
  for (const r of routines)
    // Yesterday's occurrence can run past midnight into this slot.
    for (const date of [shift(slot.day, -1), slot.day, shift(slot.day, 1)]) {
      if (!routineOn(r, date, dow(date))) continue;
      const from = localInstant(date, r.start, timezone).getTime();
      const to = from + r.duration * 60000;
      if (from < end && start < to) out.push({ kind: "routine", id: r.id, title: r.title, date, start: from, end: to });
    }
  for (const t of tasks) {
    if (t.id === ignoreId || t.status !== "pending" || !t.scheduledAt || t.fixed === false) continue;
    const from = Date.parse(t.scheduledAt);
    const to = from + t.duration * 60000;
    if (from < end && start < to)
      out.push({ kind: "task", id: t.id, title: t.title, date: localParts(new Date(from), timezone).date, start: from, end: to });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Ways out of a clash: right after it, or the same time on the next free day. */
export function clashOptions(slot: Slot, context: Context) {
  const clashes = findClashes(slot, context);
  if (!clashes.length) return { clashes, after: null, nextDay: null };
  let after: Slot | null = null;
  let cursor = Math.max(...clashes.map((c) => c.end));
  for (let i = 0; i < 12; i++) {
    const parts = localParts(new Date(cursor), context.timezone);
    // Staying on the same day keeps "right after" honest.
    if (parts.date !== slot.day) break;
    const candidate = { day: parts.date, clock: parts.clock, duration: slot.duration };
    const more = findClashes(candidate, context);
    if (!more.length) {
      after = candidate;
      break;
    }
    cursor = Math.max(...more.map((c) => c.end));
  }
  let nextDay: Slot | null = null;
  for (let i = 1; i <= 7 && !nextDay; i++) {
    const candidate = { ...slot, day: shift(slot.day, i) };
    if (!findClashes(candidate, context).length) nextDay = candidate;
  }
  return { clashes, after, nextDay };
}

export const clashText = (clash: Clash, timezone: string) => {
  const from = localParts(new Date(clash.start), timezone).clock;
  const to = localParts(new Date(clash.end), timezone).clock;
  return `${clash.title} (${from}–${to}${clash.kind === "routine" ? ", every week" : ""})`;
};
