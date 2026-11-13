import { useTempo, id, type Task } from "../data/store";
import { replanFromNow } from "./replan";
import type { Project } from "../../../../packages/core/src/model";
import { validate } from "../../../../packages/core/src/model";
import { localInstant, localParts } from "../../../../packages/core/src/scheduling";

export type Turn = { role: "user" | "assistant"; content: string };
export type CheckinKind = "start" | "end" | "followup";
type Priority = "low" | "normal" | "high";
export type AssistantAction =
  | {
      type: "add";
      title: string;
      duration: number;
      day: string | null;
      clock: string | null;
      priority: Priority;
      project: string | null;
      steps: string[];
    }
  | {
      type: "update";
      id: string;
      title?: string;
      duration?: number;
      day?: string;
      clock?: string | null;
      priority?: Priority;
    }
  | { type: "complete" | "reopen" | "delete"; id: string }
  | { type: "replan" };
export type AssistantReply = {
  reply: string;
  actions: AssistantAction[];
  listen: boolean;
  simulation: boolean;
};

const recent = 2 * 86400000;

/** Sends the conversation and a snapshot of the person's own tasks. */
export async function askTempo(
  messages: Turn[],
  checkin?: { taskId: string; kind: CheckinKind },
) {
  const state = useTempo.getState();
  const zone = state.preferences.timezone;
  const now = Date.now();
  const titles = new Map(state.projects.map((p) => [p.id, p.title]));
  const tasks = state.tasks
    .filter(
      (t) =>
        t.status === "pending" ||
        (t.completedAt && now - Date.parse(t.completedAt) < recent),
    )
    .slice(0, 300)
    .map((t) => {
      const start = t.scheduledAt ? localParts(new Date(t.scheduledAt), zone) : null;
      return {
        id: t.id,
        title: t.title,
        duration: t.duration,
        status: t.status,
        start: start ? `${start.date} ${start.clock}` : t.plannedDay ? `${t.plannedDay} flexible` : null,
        fixed: !!t.fixed,
        dueDay: t.dueDay,
        priority: t.priority || "normal",
        project: t.projectId ? titles.get(t.projectId) : undefined,
      };
    });
  return state.cloudRequest<AssistantReply>("/v1/assistant", {
    messages,
    day: localParts(new Date(), zone).date,
    timezone: zone,
    mode: state.preferences.mode,
    tasks,
    checkin: checkin ?? null,
  });
}

const timeText = (day: string | null | undefined, clock: string | null | undefined) =>
  [day, clock].filter(Boolean).join(" at ");

/** One plain-language line per proposed change, for the confirm card. */
export function describe(action: AssistantAction, tasks: Task[]) {
  const name = (taskId: string) => tasks.find((t) => t.id === taskId)?.title ?? "a task";
  switch (action.type) {
    case "add":
      return `Add “${action.title}” · ${action.duration} min${action.clock || action.day ? ` · ${timeText(action.day, action.clock)}` : ""}`;
    case "complete":
      return `Mark “${name(action.id)}” done`;
    case "reopen":
      return `Reopen “${name(action.id)}”`;
    case "delete":
      return `Delete “${name(action.id)}”`;
    case "replan":
      return "Rearrange the rest of today";
    case "update": {
      const parts = [
        action.title && `rename to “${action.title}”`,
        action.duration && `${action.duration} min`,
        action.clock === null
          ? "make flexible"
          : (action.clock || action.day) && `move to ${timeText(action.day, action.clock)}`,
        action.priority && `${action.priority} priority`,
      ].filter(Boolean);
      return `Change “${name(action.id)}”: ${parts.join(", ")}`;
    }
  }
}

/** Applies confirmed actions in one save, then replans if asked. */
export async function applyActions(actions: AssistantAction[]) {
  const state = useTempo.getState();
  const zone = state.preferences.timezone;
  const today = localParts(new Date(), zone).date;
  const changed = new Map<string, Task>();
  const removed = new Set<string>();
  const projects: Project[] = [];
  const current = (taskId: string) => changed.get(taskId) ?? state.tasks.find((t) => t.id === taskId);
  const project = (title: string | null) => {
    if (!title) return null;
    const known = [...state.projects, ...projects].find(
      (p) => p.title.trim().toLowerCase() === title.toLowerCase(),
    );
    if (known) return known.id;
    const created = { id: id(), title };
    projects.push(created);
    return created.id;
  };
  // Places a task on a day, at a time (fixed) or flexibly.
  const place = (task: Task, day: string, clock: string | null): Task =>
    clock
      ? { ...task, scheduledAt: localInstant(day, clock, zone).toISOString(), fixed: true, plannedDay: day }
      : { ...task, scheduledAt: null, fixed: false, plannedDay: day };
  for (const action of actions) {
    if (action.type === "replan") continue;
    if (action.type === "add") {
      const task = place(
        {
          id: id(),
          title: action.title,
          duration: action.duration,
          projectId: project(action.project),
          status: "pending",
          completedAt: null,
          scheduledAt: null,
          steps: action.steps,
          ...(action.priority !== "normal" ? { priority: action.priority } : {}),
        },
        action.day ?? today,
        action.clock,
      );
      changed.set(task.id, task);
      continue;
    }
    const task = current(action.id);
    if (!task) continue;
    if (action.type === "delete") {
      removed.add(task.id);
      changed.delete(task.id);
      continue;
    }
    if (action.type === "complete" || action.type === "reopen") {
      changed.set(task.id, {
        ...task,
        status: action.type === "complete" ? "completed" : "pending",
        completedAt: action.type === "complete" ? new Date().toISOString() : null,
      });
      continue;
    }
    if (action.type !== "update") continue;
    let next: Task = {
      ...task,
      ...(action.title ? { title: action.title } : {}),
      ...(action.duration ? { duration: action.duration } : {}),
      ...(action.priority ? { priority: action.priority } : {}),
    };
    if (action.day !== undefined || action.clock !== undefined) {
      const at = task.scheduledAt ? localParts(new Date(task.scheduledAt), zone) : null;
      const day = action.day ?? at?.date ?? task.plannedDay ?? today;
      // Moving a timed task to another day keeps its time unless a new one is given.
      const clock = action.clock !== undefined ? action.clock : task.fixed && at ? at.clock : null;
      next = place(next, day, clock);
    }
    changed.set(task.id, next);
  }
  const tasks = [...changed.values()].filter((t) => !removed.has(t.id));
  for (const t of tasks) validate("task", t);
  await state.applyChanges(tasks, [...removed], projects);
  if (actions.some((a) => a.type === "replan")) return replanFromNow();
  return "Done. Your plan is updated.";
}
