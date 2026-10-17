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
  if (!text.trim() || text.length > 12000) return parseCapture(text);
  try {
    const data = await useTempo
      .getState()
      .cloudRequest<{
        simulation: boolean;
        content: { tasks: unknown[]; notes: unknown[] };
      }>("/v1/plan", { text, day, timezone });
    if (data.simulation) throw new Error("AI is not configured");
    const items = validateCapture(data.content);
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
    const local = parseCapture(text);
    local.notes.unshift(
      "The AI connection is unavailable, so Tempo made a quick local plan.",
    );
    return local;
  }
}
