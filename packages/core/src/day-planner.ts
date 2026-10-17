import { validClock, validate, type Task, type Routine } from "./model.ts";
import { localInstant, localParts } from "./scheduling.ts";

export type CaptureItem = {
  title: string;
  duration: number;
  clock: string | null;
  steps: string[];
};
export type Capture = {
  items: CaptureItem[];
  notes: string[];
  source: "local" | "ai";
};

export function validateCapture(value: unknown): CaptureItem[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("tasks" in value) ||
    !Array.isArray(value.tasks) ||
    !value.tasks.length ||
    value.tasks.length > 60
  )
    throw new Error(
      "The planner could not read your tasks. Your words are still here; try again.",
    );
  return value.tasks.map((item: unknown) => {
    if (!item || typeof item !== "object")
      throw new Error("Invalid task in response");
    const v = item as Record<string, unknown>;
    if (
      typeof v.title !== "string" ||
      !v.title.trim() ||
      v.title.length > 200 ||
      !Number.isInteger(v.duration) ||
      Number(v.duration) < 1 ||
      Number(v.duration) > 1440 ||
      (v.clock !== null &&
        (typeof v.clock !== "string" || !validClock(v.clock))) ||
      !Array.isArray(v.steps) ||
      v.steps.length > 8 ||
      v.steps.some((s) => typeof s !== "string" || !s.trim() || s.length > 200)
    )
      throw new Error(
        "The planner returned an invalid task. Please try again.",
      );
    return {
      title: v.title.trim(),
      duration: Number(v.duration),
      clock: v.clock as string | null,
      steps: v.steps as string[],
    };
  });
}

// A transparent offline fallback. Natural-language AI is used when connected.
export function parseCapture(text: string): Capture {
  if (!text.trim()) throw new Error("Tell Tempo what you need to do first.");
  if (text.length > 12000)
    throw new Error("Please keep one day’s capture under 12,000 characters.");
  const notes = [
    "Quick local plan: task lengths are estimates. Check the tasks and any appointment times below.",
  ];
  const chunks = text
    .replace(/\b(?:and then|then|also)\b/gi, ",")
    .split(
      /\n|[;!?]|\.(?:\s|$)|,|\band\s+(?=(?:(?:I\s+)?(?:need to\s+|have to\s+|want to\s+)?)?(?:wash|finish|buy|call|write|read|clean|go|walk|run|cook|pick|send|reply|work|do|meet|take|prepare|review|study|pay|book|attend|have|get|make|visit|exercise|check)\b)/i,
    )
    .map((s) =>
      s
        .trim()
        .replace(
          /^(?:and\s+)?(?:I\s+)?(?:(?:need|have|want)\s+to\s+|must\s+|should\s+)?/i,
          "",
        )
        .replace(/^[-•\d]+[.)]?\s*/, "")
        .trim(),
    )
    .filter(Boolean);
  if (chunks.length > 60) throw new Error("Plan up to 60 tasks at a time.");
  const items = chunks.map((raw) => {
    let duration =
      /proposal|report|essay|presentation|study|project|design|code/i.test(raw)
        ? 60
        : /grocer|shop|gym|workout|clean|cook/i.test(raw)
          ? 45
          : /call|email|reply|pay|book/i.test(raw)
            ? 15
            : 30;
    const length = raw.match(
      /(?:for\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i,
    );
    if (length)
      duration = Math.round(
        Number(length[1]) * (/^h/i.test(length[2]) ? 60 : 1),
      );
    const at = raw.match(
      /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/i,
    );
    let clock: string | null = null;
    if (at) {
      let hour = Number(at[1]);
      const minute = Number(at[2] || 0);
      const period = at[3]?.replace(/\./g, "").toLowerCase();
      if (hour > 23 || minute > 59 || (period && (hour < 1 || hour > 12)))
        throw new Error(
          `Check the time in “${raw}”. Use a time such as 2pm or 14:00.`,
        );
      if (period) hour = (hour % 12) + (period === "pm" ? 12 : 0);
      else if (hour >= 1 && hour <= 7 && !at[2]) {
        hour += 12;
        notes.push(
          `Assumed “${at[0]}” means ${hour}:00. You can change it below.`,
        );
      }
      clock = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
    const title = raw
      .replace(length?.[0] || /$^/, "")
      .replace(at?.[0] || /$^/, "")
      .replace(/^have\s+(?:a\s+)?/i, "")
      .trim()
      .replace(/\s+/g, " ");
    if (!title || title.length > 200 || duration < 1 || duration > 1440)
      throw new Error("Check task names and durations (1–1,440 minutes).");
    const steps = /proposal|report|essay|presentation/i.test(title)
      ? [
          "Outline the main points",
          "Work through a first draft",
          "Review and finish",
        ]
      : /study|revision|exam/i.test(title)
        ? [
            "Choose the topic to cover",
            "Study in a focused session",
            "Check what you remember",
          ]
        : [];
    return {
      title: title[0].toUpperCase() + title.slice(1),
      duration,
      clock,
      steps,
    };
  });
  if (!items.length) throw new Error("Tell Tempo what you need to do first.");
  return { items, notes, source: "local" };
}

export function captureTasks(
  items: CaptureItem[],
  day: string,
  timezone: string,
  makeId: () => string,
): Task[] {
  return items.map((item) => {
    const task: Task = {
      id: makeId(),
      title: item.title.trim(),
      duration: item.duration,
      projectId: null,
      status: "pending",
      completedAt: null,
      scheduledAt: item.clock
        ? localInstant(day, item.clock, timezone).toISOString()
        : null,
      fixed: !!item.clock,
      steps: item.steps,
      plannedDay: day,
    };
    validate("task", task);
    return task;
  });
}

export type DayBlock = {
  id: string;
  title: string;
  start: string;
  duration: number;
  kind: "task" | "routine" | "break";
  task?: Task;
};
export type DayPlan = {
  tasks: Task[];
  blocks: DayBlock[];
  overflow: Task[];
  warnings: string[];
};

/** Replans only flexible work belonging to this day. Existing appointments never move. */
export function buildDay(
  tasks: Task[],
  routines: Routine[],
  day: string,
  timezone: string,
  now: Date,
  end = "21:00",
  replan = false,
): DayPlan {
  if (!validClock(end)) throw new Error("Choose a valid end time (HH:mm).");
  const today = localParts(now, timezone).date;
  if (day < today) throw new Error("Choose today or a future day.");
  const limit = localInstant(day, end, timezone).getTime();
  const startOfDay = localInstant(day, "00:00", timezone).getTime();
  const nextDay = new Date(Date.parse(`${day}T12:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
  const endOfDay = localInstant(nextDay, "00:00", timezone).getTime();
  const morning = localInstant(day, "08:00", timezone).getTime();
  const start =
    day === today
      ? Math.max(startOfDay, Math.ceil(now.getTime() / 300000) * 300000)
      : morning;
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const blocks: DayBlock[] = [];
  const warnings: string[] = [];
  for (const r of routines) {
    const previous = new Date(Date.parse(`${day}T12:00:00Z`) - 86400000)
      .toISOString()
      .slice(0, 10);
    for (const [date, dow] of [
      [day, weekday],
      [previous, (weekday + 6) % 7],
    ] as const) {
      if (!r.days.includes(dow)) continue;
      const at = localInstant(date, r.start, timezone).getTime();
      if (at + r.duration * 60000 > startOfDay)
        blocks.push({
          id: `routine-${r.id}-${date}`,
          title: r.title,
          start: new Date(at).toISOString(),
          duration: r.duration,
          kind: "routine",
        });
    }
  }
  const belongs = (t: Task) =>
    t.plannedDay === day ||
    (!!t.scheduledAt &&
      localParts(new Date(t.scheduledAt), timezone).date === day);
  const candidates: Task[] = [];
  const result = tasks.map((original) => {
    const t = { ...original };
    const movable = t.status === "pending" && t.fixed === false && belongs(t);
    if (movable && replan) t.scheduledAt = null;
    if (
      t.scheduledAt &&
      Date.parse(t.scheduledAt) < endOfDay &&
      Date.parse(t.scheduledAt) + t.duration * 60000 > startOfDay
    ) {
      blocks.push({
        id: t.id,
        title: t.title,
        start: t.scheduledAt,
        duration: t.duration,
        kind: "task",
        task: t,
      });
    } else if (t.status === "pending" && !t.scheduledAt && belongs(t))
      candidates.push(t);
    return t;
  });
  const occupied = () =>
    blocks
      .filter((b) => b.kind !== "task" || b.task?.status !== "completed")
      .map((b) => ({
        start: Date.parse(b.start),
        end: Date.parse(b.start) + b.duration * 60000,
        title: b.title,
      }))
      .sort((a, b) => a.start - b.start);
  const fixedBlocks = occupied();
  for (let i = 0; i < fixedBlocks.length; i++) {
    for (
      let j = i + 1;
      j < fixedBlocks.length && fixedBlocks[j].start < fixedBlocks[i].end;
      j++
    ) {
      if (fixedBlocks[j].end > startOfDay)
        warnings.push(
          `“${fixedBlocks[i].title}” overlaps “${fixedBlocks[j].title}”. Adjust the times before you start.`,
        );
    }
  }
  let cursor = start;
  const overflow: Task[] = [];
  for (const t of candidates) {
    let candidate = cursor;
    for (const b of occupied())
      if (candidate < b.end && candidate + t.duration * 60000 > b.start)
        candidate = b.end;
    if (candidate + t.duration * 60000 > limit) {
      overflow.push(t);
      continue;
    }
    t.scheduledAt = new Date(candidate).toISOString();
    blocks.push({
      id: t.id,
      title: t.title,
      start: t.scheduledAt,
      duration: t.duration,
      kind: "task",
      task: t,
    });
    const finish = candidate + t.duration * 60000;
    const next = occupied().find((b) => b.start >= finish);
    const breakLength = Math.min(
      10,
      Math.floor(((next?.start ?? limit) - finish) / 60000),
      Math.floor((limit - finish) / 60000),
    );
    if (breakLength > 0)
      blocks.push({
        id: `break-${t.id}`,
        title: "Take a breather",
        start: new Date(finish).toISOString(),
        duration: breakLength,
        kind: "break",
      });
    cursor = finish + Math.max(0, breakLength) * 60000;
  }
  // Restore visible breathing room when loading an already saved plan.
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start));
  sorted.forEach((block, i) => {
    if (
      block.kind !== "task" ||
      block.task?.fixed ||
      block.task?.status === "completed"
    )
      return;
    const finish = Date.parse(block.start) + block.duration * 60000;
    const next = sorted[i + 1];
    if (
      finish >= start &&
      finish + 600000 <= limit &&
      (!next || Date.parse(next.start) >= finish + 600000)
    )
      blocks.push({
        id: `rest-${block.id}`,
        title: "Take a breather",
        start: new Date(finish).toISOString(),
        duration: 10,
        kind: "break",
      });
  });
  return {
    tasks: result,
    blocks: blocks.sort((a, b) => a.start.localeCompare(b.start)),
    overflow,
    warnings,
  };
}
