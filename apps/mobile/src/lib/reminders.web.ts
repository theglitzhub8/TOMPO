// Browsers can't schedule reminders for a future time, so reminders live in the phone app.
export type ReminderStatus = "on" | "off" | "denied" | "undetermined" | "unsupported";
export const remindersSupported = false;
export async function getReminderStatus(): Promise<ReminderStatus> {
  return "unsupported";
}
export async function enableReminders(): Promise<ReminderStatus> {
  return "unsupported";
}
export async function registerPush(): Promise<"registered" | "unavailable"> {
  return "unavailable";
}
export async function disableReminders() {}
export async function syncReminders() {}
export async function sendTestReminder() {}
export function useReminders() {}
