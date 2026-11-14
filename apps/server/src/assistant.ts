import { aiConfigured, calendar, chatJson } from "./ai.js";

// The voice assistant. It reads a snapshot of the person's tasks, answers in a
// short spoken reply, and proposes changes. The app shows every proposal and
// applies nothing until the person confirms.

export type AssistantAction =
  | {
      type: "add";
      title: string;
      duration: number;
      day: string | null;
      clock: string | null;
      priority: "low" | "normal" | "high";
      project: string | null;
      steps: string[];
      note: string | null;
      dueDay: string | null;
    }
  | {
      type: "update";
      id: string;
      title?: string;
      duration?: number;
      day?: string;
      clock?: string | null;
      priority?: "low" | "normal" | "high";
      note?: string;
      project?: string | null;
    }
  | { type: "project"; title: string }
  | { type: "complete" | "reopen" | "delete"; id: string }
  | { type: "replan" };
export type AssistantReply = { reply: string; actions: AssistantAction[]; listen: boolean };

type Snapshot = {
  id: string;
  title: string;
  duration: number;
  status: "pending" | "completed";
  start: string | null;
  fixed: boolean;
  dueDay: string | null;
  priority: string;
  project: string | null;
};
export type AssistantInput = {
  messages: { role: "user" | "assistant"; content: string }[];
  day: string;
  timezone: string;
  mode: string;
  tasks: Snapshot[];
  projects: string[];
  focus: "project" | null;
  checkin: { taskId: string; kind: "start" | "end" | "followup" } | null;
};

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const realDay = (v: unknown): v is string =>
  typeof v === "string" &&
  dayPattern.test(v) &&
  Number.isFinite(Date.parse(`${v}T12:00:00Z`)) &&
  new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const priorities = ["low", "normal", "high"];

export function validateAssistantInput(input: any): AssistantInput {
  const fail = () => {
    throw new Error("Check your message and try again.");
  };
  if (!input || typeof input !== "object") fail();
  const messages = Array.isArray(input.messages) ? input.messages : [];
  if (messages.length > 20) fail();
  for (const m of messages)
    if (!m || !["user", "assistant"].includes(m.role) || !text(m.content, 4000)) fail();
  const checkin =
    input.checkin == null
      ? null
      : typeof input.checkin.taskId === "string" &&
          ["start", "end", "followup"].includes(input.checkin.kind)
        ? { taskId: input.checkin.taskId, kind: input.checkin.kind }
        : fail();
  // A check-in may open the conversation; otherwise the person speaks first.
  if (!checkin && (!messages.length || messages[messages.length - 1].role !== "user")) fail();
  if (!realDay(input.day) || typeof input.timezone !== "string") fail();
  new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format();
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  if (tasks.length > 300) fail();
  const snapshot: Snapshot[] = tasks.map((t: any) => {
    if (
      !t ||
      typeof t.id !== "string" ||
      t.id.length > 200 ||
      !text(t.title, 200) ||
      !Number.isInteger(t.duration) ||
      !["pending", "completed"].includes(t.status)
    )
      fail();
    return {
      id: t.id,
      title: t.title,
      duration: t.duration,
      status: t.status,
      start: typeof t.start === "string" && t.start.length <= 40 ? t.start : null,
      fixed: t.fixed === true,
      dueDay: realDay(t.dueDay) ? t.dueDay : null,
      priority: priorities.includes(t.priority) ? t.priority : "normal",
      project: text(t.project, 200) ? t.project : null,
    };
  });
  if (checkin && !snapshot.some((t) => t.id === checkin.taskId)) fail();
  const projects = Array.isArray(input.projects) ? input.projects : [];
  if (projects.length > 200 || projects.some((p: unknown) => !text(p, 200))) fail();
  return {
    messages: messages.map((m: any) => ({ role: m.role, content: m.content.trim() })),
    day: input.day,
    timezone: input.timezone,
    mode: ["Gentle", "Firm", "Strict"].includes(input.mode) ? input.mode : "Gentle",
    tasks: snapshot,
    projects,
    focus: input.focus === "project" ? "project" : null,
    checkin: checkin as AssistantInput["checkin"],
  };
}

/** Keeps only well-formed actions that refer to tasks the person actually has. */
export function validateAssistantReply(content: any, known: Set<string>): AssistantReply {
  if (!content || !text(content.reply, 1200)) throw new Error("AI returned no reply");
  const actions: AssistantAction[] = [];
  for (const a of Array.isArray(content.actions) ? content.actions.slice(0, 60) : []) {
    if (!a || typeof a.type !== "string") continue;
    if (a.type === "replan") {
      actions.push({ type: "replan" });
      continue;
    }
    if (a.type === "project") {
      if (text(a.title, 200)) actions.push({ type: "project", title: a.title.trim() });
      continue;
    }
    if (a.type === "add") {
      if (!text(a.title, 200) || !Number.isInteger(a.duration) || a.duration < 1 || a.duration > 1440) continue;
      if (a.clock != null && !clockPattern.test(a.clock)) continue;
      if (a.day != null && !realDay(a.day)) continue;
      if (a.dueDay != null && !realDay(a.dueDay)) continue;
      const steps = Array.isArray(a.steps)
        ? a.steps.filter((s: unknown) => text(s, 200)).slice(0, 8)
        : [];
      actions.push({
        type: "add",
        title: a.title.trim(),
        duration: a.duration,
        day: a.day ?? null,
        clock: a.clock ?? null,
        priority: priorities.includes(a.priority) ? a.priority : "normal",
        project: text(a.project, 200) ? a.project.trim() : null,
        steps,
        note: text(a.note, 300) ? a.note.trim() : null,
        dueDay: a.dueDay ?? null,
      });
      continue;
    }
    if (typeof a.id !== "string" || !known.has(a.id)) continue;
    if (["complete", "reopen", "delete"].includes(a.type)) {
      actions.push({ type: a.type, id: a.id });
      continue;
    }
    if (a.type !== "update") continue;
    const change: Extract<AssistantAction, { type: "update" }> = { type: "update", id: a.id };
    if (a.title !== undefined) {
      if (!text(a.title, 200)) continue;
      change.title = a.title.trim();
    }
    if (a.duration !== undefined) {
      if (!Number.isInteger(a.duration) || a.duration < 1 || a.duration > 1440) continue;
      change.duration = a.duration;
    }
    if (a.day !== undefined) {
      if (!realDay(a.day)) continue;
      change.day = a.day;
    }
    if (a.clock !== undefined) {
      if (a.clock !== null && !clockPattern.test(a.clock)) continue;
      change.clock = a.clock;
    }
    if (a.priority !== undefined) {
      if (!priorities.includes(a.priority)) continue;
      change.priority = a.priority;
    }
    if (a.note !== undefined) {
      if (!text(a.note, 300)) continue;
      change.note = a.note.trim();
    }
    if (a.project !== undefined) {
      if (a.project !== null && !text(a.project, 200)) continue;
      change.project = a.project === null ? null : a.project.trim();
    }
    if (Object.keys(change).length > 2) actions.push(change);
  }
  return { reply: content.reply.trim(), actions, listen: content.listen === true };
}

function system(input: AssistantInput) {
  const now = new Intl.DateTimeFormat("en-GB", {
    timeZone: input.timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const tone = {
    Gentle: "warm and encouraging",
    Firm: "friendly but direct about commitments",
    Strict: "brief and firm; hold the person to their plan",
  }[input.mode];
  const checkin = input.checkin
    ? `\nThis conversation is a check-in for task id ${input.checkin.taskId} (${
        { start: "it is due to start now", end: "its planned time has ended", followup: "it was planned earlier and is not marked done" }[input.checkin.kind]
      }). If there are no messages yet, open with one short question about it. From the answer, propose completing it, giving it more time, moving it, or breaking it into a smaller first step.`
    : "";
  const focus =
    input.focus === "project"
      ? `\nThe person opened you from their projects to describe a project. Set it up in the best way: propose {"type":"project"} with a short, clear name (unless it already exists), then break the work into concrete tasks in a sensible order, each with that project name, a realistic duration, a note, and steps for complex work. Spread the tasks over the coming days so no day is overloaded, finishing before any deadline they give (set dueDay on the tasks). If something important is missing, such as the deadline or how much time they have, ask one short question first and propose nothing yet.`
      : "";
  return `You are Tempo, a voice planning assistant inside a day-planner app. Today is ${input.day} (${now}, timezone ${input.timezone}). Be ${tone}.
The person speaks to you through speech recognition, which can mishear words: infer what they meant from context, and write task titles cleanly (correct spelling and capitalisation, no filler words, keep their language). If they ask you to polish or reword tasks, propose title updates.
You can only change their plan by proposing actions; the app shows them and nothing changes until the person confirms. Never claim a change is already made: say what you suggest.
Return JSON only: {"reply":string,"actions":Action[],"listen":boolean}.
- reply: what you say aloud. 1–3 short sentences, plain words, no lists or markdown.
- listen: true when you asked a question and expect a spoken answer.
- Action is one of:
  {"type":"add","title":string,"note":string,"duration":minutes,"day":"YYYY-MM-DD"|null,"clock":"HH:mm"|null,"priority":"low"|"normal"|"high","project":string|null,"steps":string[],"dueDay":"YYYY-MM-DD"|null}
  {"type":"update","id":string,"title"?:string,"note"?:string,"duration"?:minutes,"day"?:"YYYY-MM-DD","clock"?:"HH:mm"|null,"priority"?:"low"|"normal"|"high","project"?:string|null}
  {"type":"project","title":string} creates a project; tasks join a project by its name.
  {"type":"complete","id":string} {"type":"reopen","id":string} {"type":"delete","id":string} {"type":"replan"}
Add one task per activity the person mentions, in order, with exactly the durations they state. Set clock whenever they state or imply a start time: explicit times give that start, and sequences chain ("wake at 12, exercise 30 minutes, then clean 30 minutes" gives exercise 12:00, clean 12:30). null makes the task flexible; never invent a time. Use day for the date it should happen (null means today).
Week plans: when they talk about other days ("on Monday I have…, Wednesday I need to…"), add those tasks on their dates from the calendar below, never before today; a weekday name means its next date on or after today. Tasks on a day without times stay flexible so that day can be planned later. Remember what they said for each day across the conversation.
Every added task gets a note: one short, friendly sentence (under 140 characters) on why it matters or how to do it well, specific to the task and not repeating the title. Never a bare restatement. Estimate realistic durations when not given. Use "replan" when they want the rest of today rearranged. Only use ids from the task list. Do not invent commitments. Never delete or move fixed appointments unless explicitly asked. Propose no actions when they only want advice.${checkin}${focus}
Calendar: ${calendar(input.day).join(", ")}
Projects: ${JSON.stringify(input.projects)}
Tasks (start is local time, null when flexible): ${JSON.stringify(input.tasks)}`;
}

export async function askAssistant(raw: unknown): Promise<AssistantReply & { simulation: boolean }> {
  const input = validateAssistantInput(raw);
  if (!aiConfigured())
    return {
      simulation: true,
      reply: "The AI assistant isn’t switched on yet. You can still add and plan tasks yourself.",
      actions: [],
      listen: false,
    };
  // Providers expect the conversation to start with the person speaking.
  const messages =
    input.messages[0]?.role === "user"
      ? input.messages
      : [{ role: "user" as const, content: "(The check-in has just opened.)" }, ...input.messages];
  const content = await chatJson(system(input), messages, 8000);
  return {
    simulation: false,
    ...validateAssistantReply(content, new Set(input.tasks.map((t) => t.id))),
  };
}
