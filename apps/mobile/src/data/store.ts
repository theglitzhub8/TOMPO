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
export type {
  Task,
  Project,
  Routine,
  Preferences,
} from "../../../../packages/core/src/model";
export type Account = { id: string; name: string; email: string };
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
  revision: number;
  lastSavedAt: string | null;
  tasks: Task[];
  projects: Project[];
  routines: Routine[];
  preferences: Preferences;
  setCaptureText: (value: string) => void;
  initialize: () => Promise<void>;
  reload: () => Promise<void>;
  authenticate: (
    mode: "login" | "register",
    input: { name: string; email: string; password: string },
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  saveTasks: (tasks: Task[]) => Promise<void>;
  savePlan: (tasks: Task[], dayEnd: string) => Promise<void>;
  remove: (kind: keyof EntityMap, id: string) => Promise<void>;
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
  async function mutate(changes: Change[]) {
    if (!changes.length) return;
    const active = connection;
    if (!active) throw new Error("Sign in to save your plan.");
    const work = writes.then(async () => {
      check(active);
      set({ pending: get().pending + 1 });
      try {
        const result = await cloud<Workspace>("/v1/workspace", {
          revision: get().revision,
          changes,
        });
        check(active);
        set({ ...decodeWorkspace(result), error: null });
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
          await request(previous.base, "/v1/auth/logout", previous.token, {});
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
    cloudRequest: cloud,
    saveTasks: (tasks) =>
      mutate(
        tasks.map((payload) => ({ kind: "task", id: payload.id, payload })),
      ),
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
    remove: (kind, id) => mutate([{ kind, id, payload: null }]),
  };
});
export function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
