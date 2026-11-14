import { useTempo } from "../data/store";

/** Asks Tempo for a one-line description of a task saved without one. Best effort. */
export async function fillNote(taskId: string) {
  const state = useTempo.getState();
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || task.note) return;
  try {
    const { note } = await state.cloudRequest<{ note: string | null }>("/v1/describe", {
      title: task.title,
      duration: task.duration,
    });
    const live = useTempo.getState().tasks.find((t) => t.id === taskId);
    // The person may have written their own meanwhile.
    if (note && live && !live.note) await useTempo.getState().save("task", { ...live, note: note.slice(0, 300) });
  } catch {
    // A missing description never blocks saving.
  }
}
