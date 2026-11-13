export type AiSection =
  | "task-extraction"
  | "priority-ranking"
  | "daily-plan"
  | "rescheduling"
  | "accountability"
  | "performance-review";
const schemas: Record<AiSection, string> = {
  "task-extraction":
    'Turn one natural-language brain dump into distinct actionable tasks, retaining every commitment. Return {"tasks":[{"title":string,"duration":integer,"clock":string|null,"steps":string[],"dueDay":string|null,"priority":"low"|"normal"|"high","project":string|null}],"notes":string[]}. Titles max 200 characters, duration 1–1440 minutes, clock HH:mm ONLY for explicit fixed appointment times; otherwise null. Estimate realistic lengths when omitted. Add 2–5 concrete steps only for complex work; simple chores need no steps. Order flexible tasks by stated priority while preserving dependencies. Keep the user’s language. Do not invent commitments. Mention ambiguous times, deadlines and assumptions in notes. Never interpret deadlines as fixed start times. Resolve explicit deadlines to YYYY-MM-DD using the supplied day and timezone; otherwise dueDay null. Priority normal unless explicitly urgent/high or low. Project only when named by the user. Ask short clarification questions in notes for ambiguous commitments; keep assumptions visible. No more than 60 tasks.',
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

// Moonshot (Kimi) speaks the OpenAI chat-completions format.
export type ChatCompletion = {
  choices?: { finish_reason?: string; message?: { content?: string | null } }[];
};
export const aiConfigured = () => !!process.env.MOONSHOT_API_KEY;

/** Parses the JSON object in a chat completion, rejecting truncated replies. */
export function completionJson(data: ChatCompletion) {
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length")
    throw new Error("AI response was incomplete");
  const text = (choice?.message?.content || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
}

export async function chatJson(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 6000,
) {
  const response = await fetch(
    `${(process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1").replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
      },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: process.env.MOONSHOT_MODEL || "kimi-k3.1-pro",
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, ...messages],
      }),
    },
  );
  if (!response.ok) throw new Error(`AI provider error ${response.status}`);
  return completionJson((await response.json()) as ChatCompletion);
}

export const decodeAiContent = (data: ChatCompletion, section: AiSection) =>
  validateAiContent(completionJson(data), section);

export function validateAiContent(content: any, section: AiSection) {
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
        (t.dueDay != null && (typeof t.dueDay !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(t.dueDay) ||
          !Number.isFinite(Date.parse(t.dueDay + "T12:00:00Z")) || new Date(t.dueDay + "T12:00:00Z").toISOString().slice(0,10) !== t.dueDay)) ||
        (t.priority !== undefined && !["low", "normal", "high"].includes(t.priority)) ||
        (t.project != null && (typeof t.project !== "string" || t.project.length > 200)) ||
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

export async function askAi(section: AiSection, input: unknown) {
  if (!aiConfigured())
    return {
      simulation: true,
      section,
      content: localFallback(section, input),
      requiresConfirmation: true,
    };
  const content = await chatJson(
    `You are Tempo, a helpful day planner. ${schemas[section]} Never modify protected routines or confirmed appointments without explicit permission. Return JSON only, without markdown fences.`,
    [{ role: "user", content: JSON.stringify(input) }],
  );
  return {
    simulation: false,
    section,
    content: validateAiContent(content, section),
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
