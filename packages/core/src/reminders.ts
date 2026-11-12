import type { Preferences, Task } from "./model.ts";
import { isQuiet, localParts, reminderPlan } from "./scheduling.ts";

export type ReminderKind = "start" | "followup" | "end";
export type Reminder = {
  id: string;
  taskId: string;
  kind: ReminderKind;
  at: Date;
  title: string;
  body: string;
};

/**
 * Phone reminders for pending, scheduled tasks inside the window.
 * The start reminder always fires: the person chose that time. Follow-ups
 * (by accountability mode) and the end check-in respect quiet hours.
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
  for (const task of tasks) {
    if (task.status !== "pending" || !task.scheduledAt) continue;
    const start = Date.parse(task.scheduledAt);
    if (!Number.isFinite(start)) continue;
    const end = start + task.duration * 60000;
    const clock = localParts(new Date(start), prefs.timezone).clock;
    const endClock = localParts(new Date(end), prefs.timezone).clock;
    const company = task.with ? ` · with ${task.with}` : "";
    const key = `${task.id}:${task.scheduledAt}`;
    if (start > now.getTime())
      out.push({
        id: `${key}:start`,
        taskId: task.id,
        kind: "start",
        at: new Date(start),
        title: `It’s time: ${task.title}`,
        body: `${clock} · ${task.duration} min${company}. Tap Start, or mark it done.`,
      });
    for (const r of reminderPlan(task, prefs, now).slice(1))
      out.push({
        id: `${key}:followup:${r.at.toISOString()}`,
        taskId: task.id,
        kind: "followup",
        at: r.at,
        title: `Still to do: ${task.title}`,
        body: `This was planned for ${clock}${company}. Start now, or snooze it for 10 minutes.`,
      });
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
