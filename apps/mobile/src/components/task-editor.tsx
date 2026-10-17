import { useEffect, useState } from "react";
import { Field, Action, Body, Button, styles } from "./ui";
import { View } from "react-native";
import { useTempo, id, type Task } from "../data/store";
import {
  localInstant,
  localParts,
} from "../../../../packages/core/src/scheduling";
export function TaskEditor({
  task,
  onSave,
}: {
  task?: Task;
  onSave: (t: Task) => Promise<void>;
}) {
  const { projects, preferences } = useTempo();
  const initial = task?.scheduledAt
    ? localParts(new Date(task.scheduledAt), preferences.timezone)
    : null;
  const [title, setTitle] = useState(task?.title ?? "");
  const [duration, setDuration] = useState(String(task?.duration ?? 25));
  const [projectId, setProject] = useState<string | null>(
    task?.projectId ?? null,
  );
  const [day, setDay] = useState(initial?.date ?? "");
  const [clock, setClock] = useState(initial?.clock ?? "");
  return (
    <>
      <Field label="Task title" value={title} onChangeText={setTitle} />
      <Field
        label="Duration (minutes)"
        value={duration}
        onChangeText={setDuration}
        numeric
      />
      <Body>
        Project: {projects.find((p) => p.id === projectId)?.title ?? "None"}
      </Body>
      <View style={styles.row}>
        <Button title="None" onPress={() => setProject(null)} />
        {projects.map((p) => (
          <Button key={p.id} title={p.title} onPress={() => setProject(p.id)} />
        ))}
      </View>
      <Field
        label={`Date YYYY-MM-DD (${preferences.timezone}, optional)`}
        value={day}
        onChangeText={setDay}
      />
      <Field
        label="Start HH:mm (optional)"
        value={clock}
        onChangeText={setClock}
      />
      <Action
        title={task ? "Save task" : "Add task"}
        run={async () => {
          if (!!day !== !!clock)
            throw new Error(
              "Enter both date and start time, or leave both empty",
            );
          await onSave({
            ...task,
            id: task?.id ?? id(),
            title: title.trim(),
            duration: Number(duration),
            projectId,
            status: task?.status ?? "pending",
            completedAt: task?.completedAt ?? null,
            fixed: !!day,
            plannedDay: day || task?.plannedDay,
            scheduledAt: day
              ? localInstant(day, clock, preferences.timezone).toISOString()
              : null,
          });
          if (!task) {
            setTitle("");
            setDay("");
            setClock("");
          }
        }}
      />
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
