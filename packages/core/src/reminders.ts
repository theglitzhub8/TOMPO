import type { Preferences, Task } from "./model.ts";
import { isQuiet, localParts } from "./scheduling.ts";

export type ReminderKind = "headsup" | "start" | "followup" | "end";
export type Reminder = {
  id: string;
  taskId: string;
  kind: ReminderKind;
  at: Date;
  title: string;
  body: string;
  /** Breaks through Focus modes (iOS time-sensitive). */
  urgent?: boolean;
};

const minute = 60000;

/**
 * Phone reminders for pending, scheduled tasks inside the window, as an
 * escalation ladder:
 *   heads-up 30 min before (every mode),
 *   the start (always fires: the person chose that time),
 *   a nudge 5 min in if not started (Firm, Strict),
 *   an urgent check-in 15 min in if still not started (Strict),
 *   and the end check-in.
 * Everything except the start respects quiet hours. Nudges stop once the
 * task is started and never fire after it should have ended.
 */
export function planReminders(
  tasks: (Task & { with?: string })[],
  prefs: Preferences,
  now: Date,
  windowHours = 48,
  limit = 60,
): Reminder[] {
  const until = now.getTime() + windowHours * 3600000;
  const out: Reminder[] = [];
  const level = { Gentle: 0, Firm: 1, Strict: 2 }[prefs.mode];
  for (const task of tasks) {
    if (task.status !== "pending" || !task.scheduledAt) continue;
    const start = Date.parse(task.scheduledAt);
    if (!Number.isFinite(start)) continue;
    const end = start + task.duration * minute;
    const clock = localParts(new Date(start), prefs.timezone).clock;
    const endClock = localParts(new Date(end), prefs.timezone).clock;
    const company = task.with ? ` · with ${task.with}` : "";
    const key = `${task.id}:${task.scheduledAt}`;
    const soon = (at: number) => at > now.getTime() && !isQuiet(new Date(at), prefs);
    if (task.duration >= 15 && soon(start - 30 * minute))
      out.push({
        id: `${key}:headsup`,
        taskId: task.id,
        kind: "headsup",
        at: new Date(start - 30 * minute),
        title: `In 30 min: ${task.title}`,
        body: `${clock}${company}. ${task.note || "Wrap up what you’re doing and get ready."}`,
      });
    if (start > now.getTime())
      out.push({
        id: `${key}:start`,
        taskId: task.id,
        kind: "start",
        at: new Date(start),
        title: `It’s time: ${task.title}`,
        body: `${clock} · ${task.duration} min${company}. Tap Start, or mark it done.`,
      });
    if (!task.startedAt) {
      const nudge = start + 5 * minute;
      if (level >= 1 && nudge < end && soon(nudge))
        out.push({
          id: `${key}:followup:nudge`,
          taskId: task.id,
          kind: "followup",
          at: new Date(nudge),
          title: `Not started yet: ${task.title}`,
          body: `Just the first 5 minutes. Tap Start and go${company}.`,
        });
      const checkin = start + 15 * minute;
      if (level >= 2 && checkin < end && soon(checkin))
        out.push({
          id: `${key}:followup:checkin`,
          taskId: task.id,
          kind: "followup",
          at: new Date(checkin),
          title: `Tempo is checking in: ${task.title}`,
          body: "It was due at " + clock + ". Start it now, move it, or tell me why.",
          urgent: true,
        });
    }
    if (end > now.getTime() && !isQuiet(new Date(end), prefs))
      out.push({
        id: `${key}:end`,
        taskId: task.id,
        kind: "end",
        at: new Date(end),
        title: `Done with ${task.title}?`,
        body: `It was planned to finish at ${endClock}. Mark it done, or take 15 more minutes.`,
      });
  }
  return out
    .filter((r) => r.at.getTime() <= until)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, limit);
}
