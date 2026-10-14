import {
  validClock,
  validTimezone,
  type Routine,
  type Task,
  type Preferences,
} from "./model.ts";
export function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    clock: `${get("hour")}:${get("minute")}`,
  };
}
export function localInstant(
  day: string,
  clock: string,
  timezone: string,
): Date {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !validClock(clock) ||
    !validTimezone(timezone)
  )
    throw new Error("Invalid date, time, or timezone");
  const target = Date.parse(`${day}T${clock}:00Z`);
  let candidate = target;
  for (let i = 0; i < 5; i++) {
    const p = localParts(new Date(candidate), timezone);
    candidate += target - Date.parse(`${p.date}T${p.clock}:00Z`);
  }
  const p = localParts(new Date(candidate), timezone);
  if (p.date !== day || p.clock !== clock)
    throw new Error("This local time does not exist; choose another time");
  // Ambiguous DST times require a user choice rather than silently choosing an offset.
  for (const delta of [-3600000, 3600000, -1800000, 1800000]) {
    const other = localParts(new Date(candidate + delta), timezone);
    if (other.date === day && other.clock === clock)
      throw new Error("This local time is ambiguous; choose another time");
  }
  return new Date(candidate);
}
export function isQuiet(at: Date, prefs: Preferences) {
  const clock = localParts(at, prefs.timezone).clock;
  return (
    prefs.quietStart === prefs.quietEnd ||
    (prefs.quietStart < prefs.quietEnd
      ? clock >= prefs.quietStart && clock < prefs.quietEnd
      : clock >= prefs.quietStart || clock < prefs.quietEnd)
  );
}
export function reminderPlan(task: Task, prefs: Preferences, now: Date) {
  if (task.status === "completed" || !task.scheduledAt) return [];
  const limits = { Gentle: 0, Firm: 1, Strict: 2 };
  return Array.from({ length: limits[prefs.mode] + 1 }, (_, index) => ({
    id: `task:${task.id}:${task.scheduledAt}:${index}`,
    at: new Date(Date.parse(task.scheduledAt!) + index * 10 * 60000),
  })).filter((r) => r.at > now && !isQuiet(r.at, prefs));
}
export function planDay(
  tasks: Task[],
  routines: Routine[],
  day: string,
  timezone: string,
  start = "09:00",
  end = "21:00",
) {
  let cursor = localInstant(day, start, timezone).getTime();
  const limit = localInstant(day, end, timezone).getTime();
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const blocked = routines.flatMap((r) => {
    const begin = localInstant(day, r.start, timezone).getTime();
    const previous = new Date(Date.parse(`${day}T12:00:00Z`) - 86400000)
      .toISOString()
      .slice(0, 10);
    // Include the tail of a previous day's overnight routine only if that day is configured.
    const prior = r.days.includes((weekday + 6) % 7)
      ? localInstant(previous, r.start, timezone).getTime()
      : null;
    return [
      ...(r.days.includes(weekday)
        ? [{ start: begin, end: begin + r.duration * 60000 }]
        : []),
      ...(prior === null
        ? []
        : [{ start: prior, end: prior + r.duration * 60000 }]),
    ];
  });
  const fixed = tasks
    .filter((t) => t.status === "pending" && t.scheduledAt)
    .map((t) => ({
      start: Date.parse(t.scheduledAt!),
      end: Date.parse(t.scheduledAt!) + t.duration * 60000,
    }));
  const occupied = [...blocked, ...fixed].sort((a, b) => a.start - b.start);
  const scheduled: Task[] = [],
    unscheduled: Task[] = [];
  for (const task of tasks.filter(
    (t) => t.status === "pending" && !t.scheduledAt,
  )) {
    const duration = task.duration * 60000;
    let candidate = cursor;
    for (const block of occupied) {
      if (candidate < block.end && candidate + duration > block.start)
        candidate = block.end;
    }
    if (candidate + duration > limit) {
      unscheduled.push(task);
      continue;
    }
    scheduled.push({ ...task, scheduledAt: new Date(candidate).toISOString() });
    cursor = candidate + duration;
  }
  return { scheduled, unscheduled };
}

export function planningStart(
  day: string,
  timezone: string,
  now: Date,
): string {
  // Round to the next minute so the current day's new tasks are never in the past.
  const today = localParts(now, timezone).date;
  if (day < today) throw new Error("Choose today or a future date");
  if (day > today) return "09:00";
  const nextMinute = localParts(
    new Date(Math.floor(now.getTime() / 60000) * 60000 + 60000),
    timezone,
  );
  if (nextMinute.date !== day) return "23:59";
  return nextMinute.clock > "09:00" ? nextMinute.clock : "09:00";
}
