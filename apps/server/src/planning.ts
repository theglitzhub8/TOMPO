import { askClaude } from "./ai.js";

export function validatePlanningInput(input: unknown): {
  text: string;
  day: string;
  timezone: string;
} {
  if (!input || typeof input !== "object")
    throw new Error("Tell Tempo what you need to do.");
  const v = input as Record<string, unknown>;
  if (
    typeof v.text !== "string" ||
    !v.text.trim() ||
    v.text.length > 12000 ||
    typeof v.day !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v.day) ||
    new Date(`${v.day}T12:00:00Z`).toISOString().slice(0, 10) !== v.day ||
    typeof v.timezone !== "string"
  )
    throw new Error("Check your words, date, and timezone.");
  new Intl.DateTimeFormat("en", { timeZone: v.timezone }).format();
  return { text: v.text.trim(), day: v.day, timezone: v.timezone };
}
export class PlanningLimit {
  private entries = new Map<string, { count: number; until: number }>();
  allow(ip: string, now = Date.now()) {
    for (const [key, entry] of this.entries)
      if (entry.until <= now) this.entries.delete(key);
    const entry = this.entries.get(ip) || { count: 0, until: now + 3600000 };
    if (
      entry.count >= 20 ||
      (!this.entries.has(ip) && this.entries.size >= 10000)
    )
      return false;
    entry.count++;
    this.entries.set(ip, entry);
    return true;
  }
}
/** Receives only the submitted capture; the HTTP handler verifies the account first. */
export async function planCapture(input: unknown) {
  return askClaude("task-extraction", validatePlanningInput(input));
}
