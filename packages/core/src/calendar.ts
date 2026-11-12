import type { Task } from "./model.ts";
import { localParts } from "./scheduling.ts";
export type CalendarItem = {
  id: string;
  title: string;
  start: string;
  duration: number;
};
function stableId(value: string) {
  let hash = 14695981039346656037n;
  for (const c of value)
    hash = BigInt.asUintN(
      64,
      (hash ^ BigInt(c.codePointAt(0)!)) * 1099511628211n,
    );
  return `calendar:${hash.toString(16)}`;
}
export function calendarTasks(
  events: CalendarItem[],
  existing: Task[],
  timezone: string,
): Task[] {
  const seen = new Set(existing.map((t) => t.id));
  return events.flatMap((e) => {
    const id = stableId(e.id);
    if (seen.has(id)) return [];
    seen.add(id);
    if (
      !Number.isFinite(Date.parse(e.start)) ||
      !Number.isInteger(e.duration) ||
      e.duration < 1 ||
      e.duration > 1440 ||
      !e.title.trim() ||
      e.title.length > 200
    )
      throw new Error("Invalid calendar event.");
    return [
      {
        id,
        title: e.title,
        duration: e.duration,
        scheduledAt: e.start,
        plannedDay: localParts(new Date(e.start), timezone).date,
        projectId: null,
        status: "pending" as const,
        completedAt: null,
        fixed: true,
      },
    ];
  });
}
export function calendarText(tasks: Task[]) {
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const stamp = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tempo//Day Planner//EN",
  ];
  for (const t of tasks.filter((t) => t.scheduledAt && t.status === "pending"))
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escape(t.id)}@tempo`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(t.scheduledAt!)}`,
      `DTEND:${stamp(new Date(Date.parse(t.scheduledAt!) + t.duration * 60000).toISOString())}`,
      `SUMMARY:${escape(t.title)}`,
      "END:VEVENT",
    );
  return [...lines, "END:VCALENDAR"].join("\r\n");
}
