import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import {
  Screen,
  Card,
  Body,
  Button,
  Action,
  Heading,
  theme,
  styles,
} from "../../components/ui";
import { TaskEditor, FocusTimer } from "../../components/task-editor";
import { useTempo } from "../../data/store";
import { localParts } from "../../../../../packages/core/src/scheduling";
export default function Tasks() {
  const { tasks, projects, preferences, save } = useTempo();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const active = open ?? focus;
  return (
    <Screen
      eyebrow="EXECUTION"
      title="Tasks & priorities"
      subtitle="One important outcome at a time."
    >
      {tasks.map((task) => (
        <Card
          key={task.id}
          style={{ paddingVertical: 17, paddingHorizontal: 18, minHeight: 79 }}
        >
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`Complete ${task.title}`}
              accessibilityState={{ checked: task.status === "completed" }}
              hitSlop={10}
              onPress={async () => {
                try {
                  await save("task", {
                    ...task,
                    status:
                      task.status === "completed" ? "pending" : "completed",
                    completedAt:
                      task.status === "completed"
                        ? null
                        : new Date().toISOString(),
                  });
                  setError("");
                } catch (e) {
                  setError(String(e));
                }
              }}
              style={{
                width: 23,
                height: 23,
                borderRadius: 6,
                backgroundColor:
                  task.status === "completed"
                    ? theme.accentSoft
                    : theme.background,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.bold,
                  color: theme.accent,
                  fontSize: 15,
                }}
              >
                {task.status === "completed" ? "✓" : ""}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${task.title}`}
              onPress={() => setOpen(open === task.id ? null : task.id)}
              style={{ flex: 1, gap: 8 }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.bold,
                  fontSize: 16,
                  color: theme.ink,
                }}
              >
                {task.title}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.regular,
                  fontSize: 16,
                  color: theme.muted,
                }}
              >
                {projects.find((p) => p.id === task.projectId)?.title ??
                  "Personal"}{" "}
                ·{" "}
                {task.scheduledAt
                  ? localParts(new Date(task.scheduledAt), preferences.timezone)
                      .clock
                  : "Unscheduled"}
              </Text>
            </Pressable>
          </View>
          {active === task.id && (
            <>
              <Heading>Task details</Heading>
              <TaskEditor
                key={`${task.id}:${task.scheduledAt}:${preferences.timezone}`}
                task={task}
                onSave={async (t) => save("task", t)}
              />
              {task.status === "pending" && (
                <>
                  <Action
                    title="Postpone 30 minutes"
                    run={() =>
                      save("task", {
                        ...task,
                        scheduledAt: new Date(
                          Math.max(
                            Date.now(),
                            Date.parse(
                              task.scheduledAt ?? new Date().toISOString(),
                            ),
                          ) +
                            30 * 60000,
                        ).toISOString(),
                      })
                    }
                  />
                  <FocusTimer
                    key={`${task.id}:${focus === task.id}`}
                    duration={task.duration}
                    autoStart={focus === task.id}
                  />
                </>
              )}
            </>
          )}
        </Card>
      ))}
      {!tasks.length && (
        <Card>
          <Body>Add a task to give your day a clear starting point.</Body>
        </Card>
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {adding && (
        <Card>
          <Heading>New task</Heading>
          <TaskEditor
            onSave={async (task) => {
              await save("task", task);
              setAdding(false);
            }}
          />
        </Card>
      )}
      <View style={{ flex: 1, minHeight: 20 }} />
      <Button
        title={adding ? "Cancel new task" : "+ Add task"}
        onPress={() => setAdding(!adding)}
      />
    </Screen>
  );
}
