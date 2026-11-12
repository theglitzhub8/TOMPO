import * as Calendar from "expo-calendar";
import type { Task } from "../data/store";
export type DeviceCalendar = { id: string; title: string; writable: boolean };
export type CalendarItem = {
  id: string;
  title: string;
  start: string;
  duration: number;
};
export const calendarSupported = true;
export async function connectCalendars(): Promise<DeviceCalendar[]> {
  const permission = await Calendar.requestCalendarPermissions();
  if (permission.status !== "granted")
    throw new Error(
      "Calendar access was not granted. You can enable it in your device settings.",
    );
  return (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).map((c) => ({
    id: c.id,
    title: c.title,
    writable: c.allowsModifications,
  }));
}
export async function readCalendar(
  id: string,
  start: Date,
  end: Date,
): Promise<CalendarItem[]> {
  const calendar = await Calendar.ExpoCalendar.get(id);
  return (await calendar.listEvents(start, end))
    .filter((e) => !e.allDay)
    .flatMap((e) => {
      const at = new Date(e.startDate),
        finish = new Date(e.endDate),
        duration = Math.round((finish.getTime() - at.getTime()) / 60000);
      if (!Number.isFinite(at.getTime()) || duration < 1 || duration > 1440)
        return [];
      return [
        {
          id: `${id}:${e.id}:${at.toISOString()}`,
          title: (e.title || "Calendar appointment").slice(0, 200),
          start: at.toISOString(),
          duration,
        },
      ];
    });
}
export async function exportCalendarTask(calendarId: string, task: Task) {
  if (!task.scheduledAt) throw new Error("Schedule this task first.");
  const calendar = await Calendar.ExpoCalendar.get(calendarId);
  return calendar.addEventWithForm({
    title: task.title,
    startDate: new Date(task.scheduledAt),
    endDate: new Date(Date.parse(task.scheduledAt) + task.duration * 60000),
    notes: "Added from Tempo",
  });
}
