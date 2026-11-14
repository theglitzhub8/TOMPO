import { useTempo } from "../data/store";
import { ApiError } from "./api";
import {
  parseCapture,
  validateCapture,
  type Capture,
} from "../../../../packages/core/src/day-planner";

export async function understandDay(
  text: string,
  day: string,
  timezone: string,
): Promise<Capture> {
  if (!useTempo.getState().user) throw new Error("Sign in to use Tempo.");
  if (!text.trim() || text.length > 12000) return parseCapture(text, day);
  try {
    const data = await useTempo
      .getState()
      .cloudRequest<{
        simulation: boolean;
        content: { tasks: unknown[]; notes: unknown[] };
      }>("/v1/plan", { text, day, timezone });
    if (data.simulation) throw new Error("AI is not configured");
    const moved: string[] = [];
    // Tasks for the planned day carry no day; a day already gone lands on it.
    const items = validateCapture(data.content).map(({ day: on, ...item }) => {
      if (on && on < day) moved.push(`“${item.title}” was for ${on}, which has passed, so it’s on this plan.`);
      return on && on > day ? { ...item, day: on } : item;
    });
    const notes = Array.isArray(data.content.notes)
      ? data.content.notes
          .filter(
            (n: unknown): n is string =>
              typeof n === "string" && n.length < 400,
          )
          .slice(0, 8)
      : [];
    return {
      items,
      notes: [
        "Task lengths are estimates. Review the plan before saving.",
        ...moved,
        ...notes,
      ],
      source: "ai",
    };
  } catch (error) {
    if (
      !useTempo.getState().user ||
      (error instanceof ApiError && error.status === 401)
    )
      throw error;
    const local = parseCapture(text, day);
    local.notes.unshift(
      "The AI connection is unavailable, so Tempo made a quick local plan.",
    );
    return local;
  }
}
