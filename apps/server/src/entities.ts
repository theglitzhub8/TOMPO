export const kinds = ["task", "project", "routine", "preferences"] as const;
export type Kind = (typeof kinds)[number];
export type Change = {
  kind: Kind;
  id: string;
  payload: Record<string, unknown> | null;
};
const clock = (value: unknown) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const timestamp = (value: unknown) =>
  value === null ||
  (typeof value === "string" && Number.isFinite(Date.parse(value)));
export function validateChanges(input: unknown): Change[] {
  if (!Array.isArray(input) || !input.length || input.length > 1000)
    throw new Error("Send between 1 and 1,000 changes.");
  const seen = new Set<string>();
  return input.map((entry) => {
    if (
      !entry ||
      !kinds.includes(entry.kind) ||
      typeof entry.id !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,199}$/.test(entry.id)
    )
      throw new Error("Invalid record identifier.");
    const key = `${entry.kind}:${entry.id}`;
    if (seen.has(key))
      throw new Error("A record can only appear once per update.");
    seen.add(key);
    if (entry.kind === "preferences" && entry.id !== "singleton")
      throw new Error("Invalid preference record.");
    const p = entry.payload;
    if (p === null) return { kind: entry.kind, id: entry.id, payload: null };
    if (
      !p ||
      typeof p !== "object" ||
      Array.isArray(p) ||
      JSON.stringify(p).length > 20000
    )
      throw new Error("Invalid record.");
    if (entry.kind === "preferences") {
      if (
        typeof p.timezone !== "string" ||
        !["Gentle", "Firm", "Strict"].includes(p.mode) ||
        !clock(p.quietStart) ||
        !clock(p.quietEnd) ||
        typeof p.onboardingComplete !== "boolean" ||
        (p.dayEnd !== undefined && !clock(p.dayEnd))
      )
        throw new Error("Invalid planning preferences.");
      new Intl.DateTimeFormat("en", { timeZone: p.timezone }).format();
      return {
        kind: entry.kind,
        id: entry.id,
        payload: {
          timezone: p.timezone,
          mode: p.mode,
          quietStart: p.quietStart,
          quietEnd: p.quietEnd,
          onboardingComplete: p.onboardingComplete,
          ...(p.dayEnd === undefined ? {} : { dayEnd: p.dayEnd }),
        },
      };
    }
    if (
      p.id !== entry.id ||
      typeof p.title !== "string" ||
      !p.title.trim() ||
      p.title.length > 200
    )
      throw new Error("Enter a title of 1–200 characters.");
    const base = { id: entry.id, title: p.title.trim() };
    if (entry.kind === "project")
      return { kind: entry.kind, id: entry.id, payload: base };
    if (!Number.isInteger(p.duration) || p.duration < 1 || p.duration > 1440)
      throw new Error("Duration must be 1–1,440 minutes.");
    if (entry.kind === "routine") {
      if (
        !clock(p.start) ||
        p.protected !== true ||
        !Array.isArray(p.days) ||
        !p.days.length ||
        p.days.some(
          (d: unknown) =>
            !Number.isInteger(d) || Number(d) < 0 || Number(d) > 6,
        )
      )
        throw new Error("Invalid routine.");
      return {
        kind: entry.kind,
        id: entry.id,
        payload: {
          ...base,
          duration: p.duration,
          start: p.start,
          protected: true,
          days: [...new Set(p.days)],
        },
      };
    }
    if (
      !["pending", "completed"].includes(p.status) ||
      !timestamp(p.scheduledAt) ||
      !timestamp(p.completedAt) ||
      (p.status === "completed") !== (p.completedAt !== null) ||
      (p.projectId !== null &&
        (typeof p.projectId !== "string" || p.projectId.length > 200)) ||
      (p.fixed !== undefined && typeof p.fixed !== "boolean") ||
      (p.plannedDay !== undefined &&
        (typeof p.plannedDay !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(p.plannedDay) ||
          new Date(p.plannedDay + "T12:00:00Z").toISOString().slice(0, 10) !==
            p.plannedDay)) ||
      (p.steps !== undefined &&
        (!Array.isArray(p.steps) ||
          p.steps.length > 8 ||
          p.steps.some(
            (s: unknown) =>
              typeof s !== "string" || !s.trim() || s.length > 200,
          )))
    )
      throw new Error("Invalid task details.");
    return {
      kind: entry.kind,
      id: entry.id,
      payload: {
        ...base,
        duration: p.duration,
        projectId: p.projectId,
        status: p.status,
        scheduledAt: p.scheduledAt,
        completedAt: p.completedAt,
        ...(p.fixed === undefined ? {} : { fixed: p.fixed }),
        ...(p.plannedDay === undefined ? {} : { plannedDay: p.plannedDay }),
        ...(p.steps === undefined ? {} : { steps: p.steps }),
      },
    };
  });
}
