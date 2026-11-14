export type AiSection =
  | "task-extraction"
  | "priority-ranking"
  | "daily-plan"
  | "rescheduling"
  | "accountability"
  | "performance-review";
const schemas: Record<AiSection, string> = {
  "task-extraction":
    'Turn one natural-language description of the person\'s day, or their week, into precise, distinct tasks. Return {"tasks":[{"title":string,"note":string,"duration":integer,"day":string|null,"clock":string|null,"steps":string[],"dueDay":string|null,"priority":"low"|"normal"|"high","project":string|null}],"notes":string[]}. ' +
    "Rules, in order of importance: " +
    "(1) Capture every activity the person mentions, including personal ones like sleeping, exercise, cleaning and cooking, as its own task, in the order they will happen. Never drop, merge or invent activities. " +
    "(2) Durations: use exactly the length the person states. If an activity runs between two stated times (sleep at 10:00, wake up at 12:00), the duration is the difference (120). Estimate realistic lengths only when nothing is stated. " +
    "(3) Start times (clock, 24-hour HH:mm): set clock whenever the person states or implies when something happens. Explicit times (\"at 2pm\", \"by 10am I want to be sleeping\") give that start. Sequences (\"when I wake up at 12, exercise for 30 minutes, then clean for 30 minutes, then cook\") chain: each task starts when the previous one ends (exercise 12:00, clean 12:30, cook 13:00). A wake-up time is the moment sleep ends and the next activity begins; do not make a separate wake-up task unless the person asks for a reminder. Use null only for tasks with no timing at all, and never invent a time for those. " +
    "(4) Read times as the person means them: use context for am/pm, and mention any guess in notes. " +
    "(5) Titles: short, clean imperative phrases in the person\'s language with speech-recognition mistakes corrected (\"Exercise\", \"Clean the house\", \"Prepare food\"); max 200 characters. " +
    "(6) Add 2–5 concrete steps only for complex work; simple activities get none. " +
    "(7) dueDay only for an explicit deadline on another day, resolved to YYYY-MM-DD from the supplied day and timezone; a deadline is never a start time. Priority normal unless the person says urgent or important, low if they say it can wait. Project only when the person names one. " +
    "(8) Days: \"day\" is the date the task happens. Use null for the supplied day. When the person talks about other days (\"on Monday I have…\", \"Wednesday I need to…\", \"tomorrow\", \"this weekend\"), give each of those tasks its date from the supplied calendar, never a date before the supplied day. A weekday name means its next date on or after the supplied day. Timing rules (2) and (3) apply within each day, and tasks on a day with no times stay flexible (clock null) so they can be planned on that day. " +
    "(9) note: one short, friendly sentence (under 140 characters) on why the task matters or how to do it well, specific to this task and not repeating the title (\"A quick sweat wakes your body up for the day.\", \"Clear one room at a time so it feels lighter.\"). " +
    "(10) Put short questions about anything genuinely ambiguous in notes. No more than 100 tasks.",
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
      signal: AbortSignal.timeout(85000),
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
      content.tasks.length > 100
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
        (t.day != null && !realDay(t.day)) ||
        (t.note != null && typeof t.note !== "string") ||
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

const realDay = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(`${v}T12:00:00Z`)) &&
  new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;

/** The next two weeks as "YYYY-MM-DD Weekday", so the model never has to work out dates. */
export function calendar(day: string, days = 14) {
  const start = Date.parse(`${day}T12:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(start + i * 86400000);
    return `${date.toISOString().slice(0, 10)} ${date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}`;
  });
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
    // A whole week with notes needs more room than one day.
    section === "task-extraction" ? 12000 : 6000,
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
