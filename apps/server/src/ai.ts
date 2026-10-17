export type AiSection =
  | "task-extraction"
  | "priority-ranking"
  | "daily-plan"
  | "rescheduling"
  | "accountability"
  | "performance-review";
const schemas: Record<AiSection, string> = {
  "task-extraction":
    'Turn one natural-language brain dump into distinct actionable tasks, retaining every commitment. Return {"tasks":[{"title":string,"duration":integer,"clock":string|null,"steps":string[]}],"notes":string[]}. Titles max 200 characters, duration 1–1440 minutes, clock HH:mm ONLY for explicit fixed appointment times; otherwise null. Estimate realistic lengths when omitted. Add 2–5 concrete steps only for complex work; simple chores need no steps. Order flexible tasks by stated priority while preserving dependencies. Keep the user’s language. Do not invent commitments. Mention ambiguous times, deadlines and assumptions in notes. Never interpret deadlines as fixed start times. No more than 60 tasks.',
  "priority-ranking":
    'Return {"items":[{"id":string,"priority":number,"reason":string}]}',
  "daily-plan":
    'Return {"tasks":[{"id":string,"scheduledAt":string|null}],"notes":string}',
  rescheduling:
    'Return {"changes":[{"id":string,"scheduledAt":string|null}],"reason":string}',
  accountability: 'Return {"message":string,"nextAction":string}',
  "performance-review":
    'Return {"summary":string,"wins":string[],"focusNext":string}',
};

export function decodeAiContent(
  data: { stop_reason?: string; content?: { type: string; text?: string }[] },
  section: AiSection,
) {
  if (data.stop_reason === "max_tokens")
    throw new Error("AI response was incomplete");
  const text = data.content
    ?.filter((x) => x.type === "text")
    .map((x) => x.text || "")
    .join("\n")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let content;
  try {
    content = JSON.parse(text || "");
  } catch {
    throw new Error("AI returned invalid JSON");
  }
  if (section === "task-extraction") {
    if (
      !content ||
      !Array.isArray(content.tasks) ||
      !content.tasks.length ||
      content.tasks.length > 60
    )
      throw new Error("AI returned no usable tasks");
    for (const t of content.tasks) {
      if (
        !t ||
        typeof t.title !== "string" ||
        !t.title.trim() ||
        t.title.length > 200 ||
        !Number.isInteger(t.duration) ||
        t.duration < 1 ||
        t.duration > 1440 ||
        (t.clock !== null &&
          (typeof t.clock !== "string" ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.clock))) ||
        !Array.isArray(t.steps) ||
        t.steps.length > 8 ||
        t.steps.some(
          (s: unknown) => typeof s !== "string" || !s.trim() || s.length > 200,
        )
      )
        throw new Error("AI returned invalid task details");
    }
  }
  return content;
}

export async function askClaude(section: AiSection, input: unknown) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    return {
      simulation: true,
      section,
      content: localFallback(section, input),
      requiresConfirmation: true,
    };
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 6000,
      system: `You are Tempo, a helpful day planner. ${schemas[section]} Never modify protected routines or confirmed appointments without explicit permission. Return JSON only, without markdown fences.`,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    }),
  });
  if (!response.ok) throw new Error(`AI provider error ${response.status}`);
  return {
    simulation: false,
    section,
    content: decodeAiContent(await response.json(), section),
    requiresConfirmation: true,
  };
}
function localFallback(section: string, input: any) {
  if (section === "accountability")
    return {
      message: "Let’s choose one concrete next step.",
      nextAction:
        (Array.isArray(input?.tasks) && input.tasks[0]?.title) ||
        "Review your plan",
    };
  return {
    items: [],
    tasks: [],
    changes: [],
    notes: "AI is not configured. Use the local planner.",
  };
}
