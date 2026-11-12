import type { Task, Routine } from "./model.ts";
import { buildDay } from "./day-planner.ts";
import { shiftDay } from "./day-lifecycle.ts";
import { localParts } from "./scheduling.ts";
export type BusyBlock = {
  id: string;
  start: string;
  duration: number;
  projectId?: string;
};
/** Fit selected flexible work across seven days. Timed commitments never move. */
export function buildWeek(
  tasks: Task[],
  routines: Routine[],
  selected: string[],
  day: string,
  timezone: string,
  now: Date,
  end = "21:00",
  busy: BusyBlock[] = [],
) {
  const ids = new Set(selected);
  const candidates = tasks
    .filter((t) => ids.has(t.id) && t.status === "pending" && t.fixed === false)
    .sort(
      (a, b) =>
        (a.dueDay || "9999").localeCompare(b.dueDay || "9999") ||
        { high: 0, normal: 1, low: 2 }[a.priority || "normal"] -
          { high: 0, normal: 1, low: 2 }[b.priority || "normal"],
    );
  let result = tasks.map((t) =>
    candidates.some((c) => c.id === t.id)
      ? { ...t, scheduledAt: null }
      : { ...t },
  );
  const warnings: string[] = [];
  const waiting: Task[] = [];
  for (const task of candidates) {
    let placed = false;
    for (let i = 0; i < 7; i++) {
      const date = shiftDay(day, i);
      if (task.dueDay && date > task.dueDay) break;
      // Repeats represent a commitment for one particular date.
      const occurrence = task.occurrenceDay || task.recurrence?.startDay;
      if (occurrence && date !== occurrence) continue;
      const blockers: Task[] = busy
        .filter((b) => !b.projectId || b.projectId === task.projectId)
        .map((b) => ({
          id: `busy:${b.id}`,
          title: "Teammate unavailable",
          scheduledAt: b.start,
          duration: b.duration,
          status: "pending",
          completedAt: null,
          projectId: null,
          fixed: true,
        }));
      const existing = result.filter(
        (t) => t.id !== task.id && !!t.scheduledAt,
      );
      const breathingRoom: Task[] = existing
        .filter(t => t.status === "pending" && t.fixed === false)
        .map(t => ({
          id: `breather:${t.id}`,
          title: "Take a breather",
          scheduledAt: new Date(Date.parse(t.scheduledAt!) + t.duration * 60000).toISOString(),
          duration: 10, projectId: null, status: "pending", completedAt: null, fixed: true,
        }));
      const plan = buildDay(
        [
          ...existing,
          ...blockers,
          ...breathingRoom,
          { ...task, scheduledAt: null, plannedDay: date },
        ],
        routines,
        date,
        timezone,
        now,
        end,
      );
      const scheduled = plan.tasks.find((t) => t.id === task.id)!;
      if (!scheduled.scheduledAt) continue;
      result = result.map((t) => (t.id === task.id ? scheduled : t));
      placed = true;
      break;
    }
    if (!placed) {
      waiting.push(task);
      warnings.push(
        `${task.title}: no space${task.dueDay ? ` before the ${task.dueDay} deadline` : " this week"}.`,
      );
    }
  }
  return {
    tasks: result,
    waiting,
    warnings,
    days: Array.from({ length: 7 }, (_, i) => {
      const date = shiftDay(day, i);
      return {
        date,
        tasks: result.filter(
          (t) =>
            t.scheduledAt &&
            localParts(new Date(t.scheduledAt), timezone).date === date,
        ).sort((a,b) => a.scheduledAt!.localeCompare(b.scheduledAt!)),
      };
    }),
  };
}
