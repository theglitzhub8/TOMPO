import { create } from "zustand";
import {
  defaults,
  validate,
  type Task,
  type Project,
  type Routine,
  type Preferences,
  type EntityMap,
} from "../../../../packages/core/src/model";
import * as session from "../lib/session";
import { ApiError, apiBase, request } from "../lib/api";
import { hafrikTicket } from "../lib/hafrik";
import { recurringOccurrences, skipOccurrences } from "../../../../packages/core/src/day-lifecycle";
import { localParts } from "../../../../packages/core/src/scheduling";
export type {
  Task,
  Project,
  Routine,
  Preferences,
} from "../../../../packages/core/src/model";
export type Account = { id: string; name: string; email: string };
export type SharedTask = {
  title: string;
  duration: number;
  status: "pending" | "completed";
  scheduledAt: string | null;
  completedAt: string | null;
  steps?: string[] | null;
  plannedDay?: string | null;
  fixed?: boolean | null;
};
export type IncomingShare = {
  ownerId: string;
  taskId: string;
  status: "pending" | "accepted";
  ownerName: string;
  ownerEmail: string;
  projectTitle: string | null;
  task: SharedTask;
};
export type OutgoingShare = {
  taskId: string;
  memberId: string;
  status: "pending" | "accepted" | "declined";
  name: string;
  email: string;
};
export type Shares = { incoming: IncomingShare[]; outgoing: OutgoingShare[] };

/** The phone's own timezone, used so plans follow the clock on the device. */
export function deviceTimezone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return zone;
  } catch {
    return null;
  }
}

// Teammates' tasks enter the planner as read-only fixed blocks. These ids never get saved.
const sharedPrefix = "shared:";
export const isSharedId = (taskId: string) => taskId.startsWith(sharedPrefix);
export function sharedPlanTasks(incoming: IncomingShare[]): Task[] {
  return incoming
    .filter((s) => s.status === "accepted" && s.task.scheduledAt)
    .map((s) => ({
      id: `${sharedPrefix}${s.ownerId}:${s.taskId}`,
      title: s.task.title,
      duration: s.task.duration,
      projectId: null,
      status: s.task.status,
      scheduledAt: s.task.scheduledAt,
      completedAt: s.task.completedAt,
      fixed: true,
    }));
}
export function shareForId(incoming: IncomingShare[], taskId: string) {
  return incoming.find((s) => `${sharedPrefix}${s.ownerId}:${s.taskId}` === taskId);
}
type Workspace = {
  revision: number;
  records: {
    kind: keyof EntityMap;
    id: string;
    payload: EntityMap[keyof EntityMap];
  }[];
  savedAt: string;
};
type Change = {
  kind: keyof EntityMap;
  id: string;
  payload: EntityMap[keyof EntityMap] | null;
};
type Connection = {
  userId: string;
  token: string;
  base: string;
  epoch: number;
};
let connection: Connection | null = null;
// This phone's push address, so signing out can stop its notifications.
let devicePushToken: string | null = null;
export function rememberPushToken(token: string | null) {
  devicePushToken = token;
}
let epoch = 0;
let initialization: Promise<void> | undefined;
let writes: Promise<unknown> = Promise.resolve();
let sessionWrites: Promise<unknown> = Promise.resolve();
function persistToken(token: string | null, ticket?: number) {
  const next = sessionWrites.then(async () => {
    if (token !== null && ticket !== epoch) return;
    if (token === null) await session.deleteItemAsync("tempo-session");
    else await session.setItemAsync("tempo-session", token);
  });
  sessionWrites = next.catch(() => undefined);
  return next;
}
const empty = () => ({
  tasks: [] as Task[],
  projects: [] as Project[],
  routines: [] as Routine[],
  preferences: { ...defaults },
  captureText: "",
  revision: 0,
  lastSavedAt: null as string | null,
  pending: 0,
  undoEntry: null as { changes: Change[]; revision: number } | null,
  shares: { incoming: [], outgoing: [] } as Shares,
});
function decodeWorkspace(workspace: Workspace) {
  if (
    !workspace ||
    !Number.isSafeInteger(workspace.revision) ||
    !Array.isArray(workspace.records)
  )
    throw new Error("Could not read your saved workspace.");
  const state = empty();
  for (const record of workspace.records) {
    if (!["task", "project", "routine", "preferences"].includes(record.kind))
      throw new Error("Unknown cloud record.");
    validate(record.kind, record.payload);
    if (record.kind === "task") state.tasks.push(record.payload as Task);
    if (record.kind === "project")
      state.projects.push(record.payload as Project);
    if (record.kind === "routine")
      state.routines.push(record.payload as Routine);
    if (record.kind === "preferences")
      state.preferences = record.payload as Preferences;
  }
  return {
    tasks: state.tasks,
    projects: state.projects,
    routines: state.routines,
    preferences: state.preferences,
    revision: workspace.revision,
    lastSavedAt: workspace.savedAt,
  };
}
function account(value: Account) {
  if (
    !value ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.email !== "string"
  )
    throw new Error("Could not verify this account.");
  return value;
}
type State = {
  ready: boolean;
  booting: boolean;
  error: string | null;
  user: Account | null;
  captureText: string;
  pending: number;
  undoEntry: { changes: Change[]; revision: number } | null;
  undo: () => Promise<void>;
  revision: number;
  lastSavedAt: string | null;
  tasks: Task[];
  projects: Project[];
  routines: Routine[];
  preferences: Preferences;
  shares: Shares;
  loadShares: () => Promise<void>;
  sync: () => Promise<void>;
  invite: (taskId: string, email: string) => Promise<void>;
  respondShare: (ownerId: string, taskId: string, accept: boolean) => Promise<void>;
  removeShare: (ownerId: string, taskId: string, memberId: string) => Promise<void>;
  setSharedDone: (ownerId: string, taskId: string, done: boolean) => Promise<void>;
  removeTasks: (ids: string[]) => Promise<void>;
  setCaptureText: (value: string) => void;
  initialize: () => Promise<void>;
  reload: () => Promise<void>;
  authenticate: (
    mode: "login" | "register",
    input: { name: string; email: string; password: string },
  ) => Promise<void>;
  /** Resolves false when the person closes the Hafrik sheet. */
  signInWithHafrik: () => Promise<boolean>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  saveTasks: (tasks: Task[]) => Promise<void>;
  /** Saves confirmed assistant changes as one revision. */
  applyChanges: (tasks: Task[], removedIds: string[], projects: Project[], routines?: Routine[]) => Promise<void>;
  savePlan: (tasks: Task[], dayEnd: string) => Promise<void>;
  saveReviewedPlan: (tasks: Task[], dayEnd: string, revision: number) => Promise<void>;
  refreshRecurring: () => Promise<void>;
  remove: (kind: keyof EntityMap, id: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  save: <K extends keyof EntityMap>(
    kind: K,
    value: EntityMap[K],
  ) => Promise<void>;
  cloudRequest: <T>(path: string, body?: unknown) => Promise<T>;
};
export const useTempo = create<State>((set, get) => {
  const expire = () => {
    epoch++;
    connection = null;
    initialization = undefined;
    set({
      ...empty(),
      user: null,
      ready: false,
      booting: false,
      error: "Your session ended. Sign in again.",
    });
    void persistToken(null);
  };
  const check = (active: Connection) => {
    if (connection !== active || active.epoch !== epoch)
      throw new ApiError("Your account changed. Please try again.",401);
  };
  async function cloud<T>(
    path: string,
    body?: unknown,
    method?: string,
  ): Promise<T> {
    const active = connection;
    if (!active) throw new Error("Sign in to use Tempo.");
    try {
      const result = await request<T>(
        active.base,
        path,
        active.token,
        body,
        method,
      );
      check(active);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && connection === active)
        expire();
      throw e;
    }
  }
  async function mutate(changes: Change[], expectedRevision?: number, recordUndo = true) {
    if (!changes.length) return;
    const active = connection;
    if (!active) throw new Error("Sign in to save your plan.");
    const work = writes.then(async () => {
      check(active);
      if (expectedRevision !== undefined && get().revision !== expectedRevision)
        throw new Error("Your plan changed. Review it again before saving.");
      const snapshot = get();
      const inverse: Change[] = changes.map(change => {
        const values = change.kind === "task" ? snapshot.tasks : change.kind === "project" ? snapshot.projects : change.kind === "routine" ? snapshot.routines : null;
        return { kind: change.kind, id: change.id, payload: values ? values.find(v => v.id === change.id) ?? null : { ...snapshot.preferences } };
      });
      set({ pending: get().pending + 1 });
      try {
        const result = await cloud<Workspace>("/v1/workspace", {
          revision: get().revision,
          changes,
        });
        check(active);
        set({ ...decodeWorkspace(result), error: null,
          ...(recordUndo ? { undoEntry: changes.some(c => c.payload === null) ? null : { changes: inverse, revision: result.revision } } : {}) });
      } catch (e) {
        if (
          e instanceof ApiError &&
          e.status === 409 &&
          connection === active
        ) {
          const latest = (e.data as { workspace: Workspace }).workspace;
          set(decodeWorkspace(latest));
        }
        if (connection === active)
          set({
            error:
              e instanceof Error
                ? e.message
                : "Could not save your plan online.",
          });
        throw e;
      } finally {
        if (connection === active)
          set({ pending: Math.max(0, get().pending - 1) });
      }
    });
    writes = work.catch(() => undefined);
    return work;
  }
  // Keep plans on the phone's clock, and pull in teammates' tasks.
  async function afterSignIn() {
    const zone = deviceTimezone();
    const { preferences } = get();
    if (zone && preferences.timezone !== zone)
      try {
        await mutate([
          {
            kind: "preferences",
            id: "singleton",
            payload: { ...preferences, timezone: zone },
          },
        ]);
      } catch {
        /* The next sign-in or sync tries again. */
      }
    try {
      await get().loadShares();
    } catch {
      /* Sharing is optional; the plan still works. */
    }
  }
  // Finishes any sign-in once the server has issued a session token.
  async function open(
    base: string,
    result: { user: Account; token: string },
    ticket: number,
  ) {
    const user = account(result.user);
    if (!/^[a-f0-9]{64}$/.test(result.token))
      throw new Error("Could not establish a secure session.");
    const workspace = await request<Workspace>(
      base,
      "/v1/workspace",
      result.token,
    );
    if (ticket !== epoch) throw new Error("Account request was superseded.");
    const data = decodeWorkspace(workspace);
    await persistToken(result.token, ticket);
    if (ticket !== epoch) return;
    connection = {
      userId: user.id,
      token: result.token,
      base,
      epoch: ticket,
    };
    set({ ...data, user, ready: true, booting: false, error: null });
    void afterSignIn();
  }
  return {
    ...empty(),
    ready: false,
    booting: true,
    error: null,
    user: null,
    setCaptureText: (captureText) => set({ captureText }),
    initialize: () => {
      if (initialization) return initialization;
      const ticket = ++epoch;
      connection = null;
      set({ ...empty(), user: null, ready: false, booting: true, error: null });
      initialization = (async () => {
        try {
          await sessionWrites;
          const token = await session.getItemAsync("tempo-session");
          if (ticket !== epoch) return;
          if (!token) {
            set({ booting: false });
            return;
          }
          const base = await apiBase();
          const me = await request<{ user: Account }>(
            base,
            "/v1/auth/me",
            token,
          );
          const user = account(me.user);
          const workspace = await request<Workspace>(
            base,
            "/v1/workspace",
            token,
          );
          if (ticket !== epoch) return;
          const data = decodeWorkspace(workspace);
          connection = { userId: user.id, token, base, epoch: ticket };
          set({ ...data, user, ready: true, booting: false, error: null });
          void afterSignIn();
        } catch (e) {
          if (ticket !== epoch) return;
          if (e instanceof ApiError && e.status === 401)
            await persistToken(null);
          set({
            booting: false,
            error:
              e instanceof Error ? e.message : "Could not open your account.",
          });
        } finally {
          if (ticket === epoch) initialization = undefined;
        }
      })();
      return initialization;
    },
    authenticate: async (mode, input) => {
      const ticket = ++epoch;
      connection = null;
      set({ ...empty(), user: null, ready: false, error: null });
      const base = await apiBase();
      const result = await request<{ user: Account; token: string }>(
        base,
        `/v1/auth/${mode}`,
        null,
        input,
      );
      await open(base, result, ticket);
    },
    signInWithHafrik: async () => {
      const base = await apiBase();
      const grant = await hafrikTicket(base);
      if (!grant) return false;
      const ticket = ++epoch;
      connection = null;
      set({ ...empty(), user: null, ready: false, error: null });
      const result = await request<{ user: Account; token: string }>(
        base,
        "/v1/auth/hafrik/session",
        null,
        grant,
      );
      await open(base, result, ticket);
      return true;
    },
    signOut: async () => {
      const previous = connection;
      epoch++;
      connection = null;
      initialization = undefined;
      set({
        ...empty(),
        user: null,
        ready: false,
        booting: false,
        error: null,
      });
      await persistToken(null);
      if (previous)
        try {
          await request(previous.base, "/v1/auth/logout", previous.token, {
            pushToken: devicePushToken,
          });
        } catch {
          /* The local account stays locked even if the network is unavailable. */
        }
    },
    reload: async () => {
      const active = connection;
      if (!active) throw new Error("Sign in first.");
      await writes;
      const result = await cloud<Workspace>("/v1/workspace");
      check(active);
      set({ ...decodeWorkspace(result), error: null });
    },
    updateName: async (name) => {
      const result = await cloud<{ user: Account }>(
        "/v1/auth/me",
        { name },
        "PATCH",
      );
      set({ user: account(result.user) });
    },
    cloudRequest: async <T>(path: string, body?: unknown) => {
      const result = await cloud<T>(path, body);
      if (body !== undefined && path.startsWith("/v1/team")) set({ undoEntry: null });
      return result;
    },
    undo: async () => {
      const entry = get().undoEntry;
      if (!entry || entry.revision !== get().revision) throw new Error("Your workspace changed. The last edit can no longer be undone safely.");
      await mutate(entry.changes, entry.revision, false);
      set({ undoEntry: null });
    },
    saveTasks: (tasks) =>
      mutate(
        tasks.map((payload) => ({ kind: "task", id: payload.id, payload })),
      ),
    applyChanges: (tasks, removedIds, projects, routines = []) =>
      mutate([
        ...projects.map((payload) => ({ kind: "project" as const, id: payload.id, payload })),
        ...routines.map((payload) => ({ kind: "routine" as const, id: payload.id, payload })),
        ...tasks.map((payload) => ({ kind: "task" as const, id: payload.id, payload })),
        ...skipOccurrences(get().tasks, removedIds).map((payload) => ({ kind: "task" as const, id: payload.id, payload })),
        ...removedIds.map((id) => ({ kind: "task" as const, id, payload: null })),
      ]),
    savePlan: (tasks, dayEnd) =>
      mutate([
        ...tasks.map((payload) => ({
          kind: "task" as const,
          id: payload.id,
          payload,
        })),
        {
          kind: "preferences",
          id: "singleton",
          payload: { ...get().preferences, dayEnd },
        },
      ]),
    saveReviewedPlan: (tasks, dayEnd, revision) => mutate([
      ...tasks.map(payload => ({ kind: "task" as const, id: payload.id, payload })),
      { kind: "preferences", id: "singleton", payload: { ...get().preferences, dayEnd } },
    ], revision),
    refreshRecurring: async () => {
      const current = get();
      if (!connection || current.pending) return;
      const day = localParts(new Date(), current.preferences.timezone).date;
      const occurrences = recurringOccurrences(current.tasks, day, current.preferences.timezone);
      if (occurrences.length) await mutate(occurrences.slice(0, 1000).map(payload => ({ kind: "task", id: payload.id, payload })), current.revision, false);
    },
    save: (kind, payload) =>
      mutate([
        {
          kind,
          id:
            kind === "preferences"
              ? "singleton"
              : (payload as { id: string }).id,
          payload,
        },
      ]),
    remove: (kind, id) => mutate([
      ...(kind === "task" ? skipOccurrences(get().tasks, [id]).map(payload => ({ kind: "task" as const, id: payload.id, payload })) : []),
      { kind, id, payload: null },
    ]),
    removeTasks: async (ids) => {
      for (let i = 0; i < ids.length; i += 400)
        await mutate(
          [
            ...skipOccurrences(get().tasks, ids.slice(i, i + 400)).map(payload => ({ kind: "task" as const, id: payload.id, payload })),
            ...ids.slice(i, i + 400).map((id) => ({ kind: "task" as const, id, payload: null })),
          ],
        );
    },
    loadShares: async () => {
      const active = connection;
      const result = await cloud<Shares>("/v1/shares");
      if (connection === active) set({ shares: result });
    },
    sync: async () => {
      if (!connection || get().pending) return;
      await Promise.all([get().reload(), get().loadShares()]);
      const zone = deviceTimezone();
      if (zone && get().preferences.timezone !== zone)
        await get().save("preferences", { ...get().preferences, timezone: zone });
      await get().refreshRecurring();
    },
    invite: async (taskId, email) => {
      await cloud("/v1/shares", { taskId, email });
      set({ undoEntry: null });
      await get().loadShares();
    },
    respondShare: async (ownerId, taskId, accept) => {
      await cloud("/v1/shares/respond", { ownerId, taskId, accept });
      await get().loadShares();
    },
    removeShare: async (ownerId, taskId, memberId) => {
      await cloud("/v1/shares/remove", { ownerId, taskId, memberId });
      await get().loadShares();
    },
    setSharedDone: async (ownerId, taskId, done) => {
      await cloud("/v1/shares/done", { ownerId, taskId, done });
      // The owner's workspace revision moved; refresh it when it's ours.
      if (ownerId === get().user?.id) await get().reload();
      await get().loadShares();
    },
    // One atomic write: the server rejects tasks that point at a missing project.
    removeProject: (id) =>
      mutate([
        ...get()
          .tasks.filter((t) => t.projectId === id)
          .map((t) => ({
            kind: "task" as const,
            id: t.id,
            payload: { ...t, projectId: null },
          })),
        { kind: "project", id, payload: null },
      ]),
  };
});
export function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
