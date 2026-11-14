import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Field, Action, Body, Button, theme } from "./ui";
import { ProjectPicker } from "./project-picker";
import { useTempo, id, type Task } from "../data/store";
import {
  localInstant,
  localParts,
} from "../../../../packages/core/src/scheduling";
import { clashOptions, clashText } from "../../../../packages/core/src/clashes";
import { fillNote } from "../lib/describe";
export function TaskEditor({
  task,
  onSave,
  initialProjectId = null,
}: {
  task?: Task;
  onSave: (t: Task) => Promise<void>;
  initialProjectId?: string | null;
}) {
  const { projects, preferences } = useTempo();
  const initial = task?.scheduledAt
    ? localParts(new Date(task.scheduledAt), preferences.timezone)
    : null;
  const [dueDay, setDueDay] = useState(task?.dueDay || "");
  const [priority, setPriority] = useState<Task["priority"]>(task?.priority || "normal");
  const [title, setTitle] = useState(task?.title ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [duration, setDuration] = useState(String(task?.duration ?? 25));
  const [projectId, setProject] = useState<string | null>(
    task ? task.projectId : initialProjectId,
  );
  const [day, setDay] = useState(initial?.date ?? "");
  const [clock, setClock] = useState(initial?.clock ?? "");
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekdays" | "weekly">(
    !task?.recurrence ? "none" : task.recurrence.days.length === 7 ? "daily" : task.recurrence.days.length === 5 ? "weekdays" : "weekly",
  );
  const [clash, setClash] = useState<ReturnType<typeof clashOptions> | null>(null);
  const commit = async (day: string, clock: string) => {
    const startDay = day || task?.recurrence?.startDay || task?.plannedDay || localParts(new Date(), preferences.timezone).date;
    const weekday = new Date(`${startDay}T12:00:00Z`).getUTCDay();
    const taskId = task?.id ?? id();
    await onSave({
      ...task,
      id: taskId,
      title: title.trim(),
      note: note.trim().slice(0, 300) || undefined,
      dueDay: dueDay || undefined,
      priority,
      duration: Number(duration),
      projectId,
      status: task?.status ?? "pending",
      completedAt: task?.completedAt ?? null,
      fixed: !!day,
      plannedDay: day || task?.plannedDay || (repeat !== "none" ? startDay : undefined),
      recurrence: task?.seriesId || repeat === "none" ? undefined : {
        ...task?.recurrence,
        startDay,
        days: repeat === "daily" ? [0, 1, 2, 3, 4, 5, 6] : repeat === "weekdays" ? [1, 2, 3, 4, 5] : [weekday],
      },
      scheduledAt: day
        ? localInstant(day, clock, preferences.timezone).toISOString()
        : null,
    });
    await useTempo.getState().refreshRecurring();
    if (!note.trim()) void fillNote(taskId);
    setClash(null);
    if (!task) {
      setTitle("");
      setNote("");
      setDay("");
      setClock("");
      setRepeat("none");
    } else {
      setDay(day);
      setClock(clock);
    }
  };
  return (
    <>
      <Field label="Task title" value={title} onChangeText={setTitle} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} multiline placeholder="Why it matters or how to do it" />
      <Field
        label="Duration (minutes)"
        value={duration}
        onChangeText={(v) => { setDuration(v); setClash(null); }}
        numeric
      />
      <Field label="Deadline YYYY-MM-DD (optional)" value={dueDay} onChangeText={setDueDay} />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {(["low", "normal", "high"] as const).map(value => <Button key={value} title={`${value} priority`} compact variant={priority === value ? "accent" : "secondary"} onPress={() => setPriority(value)} />)}
      </View>
      <ProjectPicker projects={projects} value={projectId} onChange={setProject} />
      <Field
        label={`Date YYYY-MM-DD (${preferences.timezone}, optional)`}
        value={day}
        onChangeText={(v) => { setDay(v); setClash(null); }}
      />
      <Field
        label="Start HH:mm (optional)"
        value={clock}
        onChangeText={(v) => { setClock(v); setClash(null); }}
      />
      {task?.seriesId ? <Body small>This is one occurrence. Edit the original task to change future repeats.</Body> : <>
        <Body small>Repeat · new occurrences are prepared for the next seven days when you open Tempo. Flexible repeats wait for planning.</Body>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {([ ["none", "Never"], ["daily", "Daily"], ["weekdays", "Weekdays"], ["weekly", "Weekly"] ] as const).map(([value, label]) =>
            <Button key={value} title={label} compact variant={repeat === value ? "accent" : "secondary"} onPress={() => setRepeat(value)} />)}
        </View>
        {task?.recurrence && <Body small>Changing or stopping repeats affects newly created occurrences. Tasks already created stay in your task list.</Body>}
      </>}
      {clash ? (
        <View style={{ gap: 10, padding: 14, borderRadius: 16, backgroundColor: theme.sunSoft }}>
          <Text style={{ fontFamily: theme.fonts.bold, fontSize: 14.5, color: theme.ink }}>That time is taken.</Text>
          <Body small style={{ color: theme.inkSoft }}>
            {day} {clock} clashes with {clash.clashes.map((c) => clashText(c, preferences.timezone)).join(" and ")}.
          </Body>
          <View style={{ gap: 8 }}>
            {clash.after && (
              <Action title={`Right after it · ${clash.after.clock}`} icon="arrow" compact run={() => commit(clash.after!.day, clash.after!.clock)} />
            )}
            {clash.clashes
              .filter((c) => c.kind === "routine")
              .slice(0, 1)
              .map((c) => (
                <Action
                  key={c.id}
                  title={`Skip ${c.title} on ${c.date} only`}
                  variant="secondary"
                  compact
                  run={async () => {
                    const state = useTempo.getState();
                    const routine = state.routines.find((r) => r.id === c.id);
                    if (routine)
                      await state.save("routine", {
                        ...routine,
                        skippedDays: [...new Set([...(routine.skippedDays ?? []), c.date])],
                      });
                    await commit(day, clock);
                  }}
                />
              ))}
            {clash.nextDay && (
              <Action title={`${clash.nextDay.day} at ${clash.nextDay.clock} instead`} variant="secondary" compact run={() => commit(clash.nextDay!.day, clash.nextDay!.clock)} />
            )}
            <Action title="Keep both" variant="ghost" compact run={() => commit(day, clock)} />
          </View>
        </View>
      ) : (
        <Action
          title={task ? "Save task" : "Add task"}
          run={async () => {
            if (!!day !== !!clock)
              throw new Error(
                "Enter both date and start time, or leave both empty",
              );
            if (day && clock) {
              // Check the regular week and appointments before booking the time.
              const state = useTempo.getState();
              const options = clashOptions(
                { day, clock, duration: Number(duration) || 30 },
                { routines: state.routines, tasks: state.tasks, timezone: preferences.timezone, ignoreId: task?.id },
              );
              if (options.clashes.length) {
                setClash(options);
                return;
              }
            }
            await commit(day, clock);
          }}
        />
      )}
    </>
  );
}
export function FocusTimer({
  duration,
  autoStart = false,
}: {
  duration: number;
  autoStart?: boolean;
}) {
  const [end, setEnd] = useState<number | null>(() =>
    autoStart ? Date.now() + duration * 60000 : null,
  );
  const [remaining, setRemaining] = useState(autoStart ? duration * 60 : 0);
  useEffect(() => {
    if (!end) return;
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [end]);
  return (
    <>
      <Body>
        {end
          ? remaining
            ? `Focus · ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
            : "Focus session finished"
          : "Focus timer is available while this screen stays open."}
      </Body>
      <Button
        title={end ? "End focus" : `Focus ${duration} minutes`}
        onPress={() => setEnd(end ? null : Date.now() + duration * 60000)}
      />
    </>
  );
}
