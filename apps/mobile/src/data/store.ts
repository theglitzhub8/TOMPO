import { create } from "zustand";
import { openDatabaseAsync } from "expo-sqlite";
import { Repository } from "../../../../packages/core/src/repository";
import {
  defaults,
  type Task,
  type Project,
  type Routine,
  type Preferences,
  type EntityMap,
} from "../../../../packages/core/src/model";
export type {
  Task,
  Project,
  Routine,
  Preferences,
} from "../../../../packages/core/src/model";
let repository: Repository | undefined;
let initialization: Promise<void> | undefined;
type State = {
  ready: boolean;
  error: string | null;
  tasks: Task[];
  projects: Project[];
  routines: Routine[];
  preferences: Preferences;
  pending: number;
  initialize: () => Promise<void>;
  reload: () => Promise<void>;
  saveTasks: (tasks: Task[]) => Promise<void>;
  remove: (kind: keyof EntityMap, id: string) => Promise<void>;
  save: <K extends keyof EntityMap>(
    kind: K,
    value: EntityMap[K],
  ) => Promise<void>;
};
export const useTempo = create<State>((set, get) => ({
  ready: false,
  error: null,
  tasks: [],
  projects: [],
  routines: [],
  preferences: defaults,
  pending: 0,
  initialize: () => {
    if (!initialization)
      initialization = (async () => {
        try {
          repository = new Repository(await openDatabaseAsync("tempo.db"));
          await repository.initialize();
          await get().reload();
          set({ ready: true, error: null });
          if (__DEV__) console.info("[TEMPO] SQLite hydration complete");
        } catch (error) {
          initialization = undefined;
          set({ error: String(error), ready: false });
        }
      })();
    return initialization;
  },
  reload: async () => {
    if (!repository) throw new Error("Database unavailable");
    const [tasks, projects, routines, preferences, changes] = await Promise.all(
      [
        repository.list("task"),
        repository.list("project"),
        repository.list("routine"),
        repository.preferences(),
        repository.pendingChanges(),
      ],
    );
    set({ tasks, projects, routines, preferences, pending: changes.length });
  },
  saveTasks: async (tasks) => {
    if (!repository) throw new Error("Database unavailable");
    await repository.saveMany("task", tasks);
    await get().reload();
  },
  remove: async (kind, entityId) => {
    if (!repository) throw new Error("Database unavailable");
    await repository.remove(kind, entityId);
    await get().reload();
  },
  save: async (kind, value) => {
    if (!repository) throw new Error("Database unavailable");
    await repository.save(kind, value);
    await get().reload();
  },
}));
export function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
