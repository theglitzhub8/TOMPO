import type { Task } from "../data/store";
export type DeviceCalendar = { id: string; title: string; writable: boolean };
export type CalendarItem = {
  id: string;
  title: string;
  start: string;
  duration: number;
};
export const calendarSupported = false;
export async function connectCalendars(): Promise<DeviceCalendar[]> {
  throw new Error("Connect calendars from a rebuilt iOS or Android app.");
}
export async function readCalendar(
  _id: string,
  _start: Date,
  _end: Date,
): Promise<CalendarItem[]> {
  return [];
}
export async function exportCalendarTask(_id: string, _task: Task) {
  throw new Error("Use the installed app to add this task to your calendar.");
}
