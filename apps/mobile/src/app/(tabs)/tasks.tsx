import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  Screen,
  Card,
  Body,
  Button,
  Action,
  Heading,
  Icon,
  Notice,
  Tap,
  theme,
  Field,
} from "../../components/ui";
import { TaskEditor, FocusTimer } from "../../components/task-editor";
import { projectColor } from "../../components/project-picker";
import { PeopleStack, TaskPeople } from "../../components/task-people";
import { useTempo, type Task } from "../../data/store";
import { localParts } from "../../../../../packages/core/src/scheduling";

type Filter = "all" | string;

export default function Tasks() {
  const { tasks, projects, preferences, save, shares, removeTasks } = useTempo();
  const [query, setQuery] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const active = open ?? focus;
  const inFilter = tasks.filter(t => (filter === "all" || t.projectId === filter) &&
    `${t.title} ${t.note || ""} ${t.steps?.join(" ") || ""} ${projects.find(p => p.id === t.projectId)?.title || ""} ${t.dueDay || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const visible = inFilter
    .filter((t) => t.status === "pending")
    .sort((a, b) => (a.scheduledAt || "z").localeCompare(b.scheduledAt || "z"));
  const done = inFilter
    .filter((t) => t.status === "completed")
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  const today = localParts(new Date(), preferences.timezone).date;
  const doneBefore = done.filter(
    (t) => t.completedAt && localParts(new Date(t.completedAt), preferences.timezone).date < today,
  );
  const filters: { id: Filter; title: string; color?: string; count: number }[] = [
    { id: "all", title: "All", count: tasks.length },
    ...projects.map((p) => ({
      id: p.id,
      title: p.title,
      color: projectColor(p.id),
      count: tasks.filter((t) => t.projectId === p.id).length,
    })),
  ];
  function renderTask(task: Task) {
    const project = projects.find((p) => p.id === task.projectId);
    const isDone = task.status === "completed";
    const color = projectColor(task.projectId);
    return (
      <Card key={task.id} style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`Complete ${task.title}`}
            accessibilityState={{ checked: isDone }}
            hitSlop={10}
            onPress={async () => {
              try {
                await save("task", {
                  ...task,
                  status: isDone ? "pending" : "completed",
                  completedAt: isDone ? null : new Date().toISOString(),
                });
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            <Icon
              name={isDone ? "checkCircle" : "circle"}
              size={26}
              color={isDone ? theme.mintDeep : theme.faint}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${task.title}`}
            onPress={() => setOpen(active === task.id ? null : task.id)}
            style={{ flex: 1, gap: 5 }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.bold,
                fontSize: 16,
                lineHeight: 22,
                color: isDone ? theme.faint : theme.ink,
                textDecorationLine: isDone ? "line-through" : "none",
              }}
            >
              {task.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {project && (
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
              )}
              {project && (
                <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 12.5, color }}>
                  {project.title}
                </Text>
              )}
              <Text style={{ fontFamily: theme.fonts.medium, fontSize: 12.5, color: theme.faint }}>
                {project ? "· " : ""}
                {task.scheduledAt
                  ? localParts(new Date(task.scheduledAt), preferences.timezone).clock
                  : "Unscheduled"}{" "}
                · {task.duration} min{task.dueDay ? ` · due ${task.dueDay}` : ""}{task.priority === "high" ? " · High priority" : ""}
                {task.recurrence ? " · Repeats" : task.seriesId ? " · Recurring occurrence" : ""}
              </Text>
            </View>
          </Pressable>
          <PeopleStack
            names={shares.outgoing
              .filter((p) => p.taskId === task.id && p.status !== "declined")
              .map((p) => p.name)}
          />
          <Icon name={active === task.id ? "collapse" : "expand"} size={20} color={theme.faint} />
        </View>
        {active === task.id && (
          <View style={{ gap: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.line }}>
            <TaskEditor
              key={`${task.id}:${task.scheduledAt}:${preferences.timezone}`}
              task={task}
              onSave={async (t) => save("task", t)}
            />
            <View style={{ height: 1, backgroundColor: theme.line }} />
            <TaskPeople task={task} />
            {task.status === "pending" && (
              <>
                <Action
                  title="Postpone 30 minutes"
                  icon="redo"
                  variant="secondary"
                  run={() =>
                    save("task", {
                      ...task,
                      scheduledAt: new Date(
                        Math.max(
                          Date.now(),
                          Date.parse(task.scheduledAt ?? new Date().toISOString()),
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
          </View>
        )}
      </Card>
    );
  }
  return (
    <Screen
      eyebrow="EXECUTION"
      title="Tasks &"
      titleAccent="priorities."
      subtitle="One important outcome at a time."
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {filters.map((f) => {
          const selected = filter === f.id;
          return (
            <Tap
              key={f.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${f.title}, ${f.count} tasks`}
              onPress={() => setFilter(f.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                height: 38,
                paddingHorizontal: 14,
                borderRadius: 19,
                borderWidth: 1,
                borderColor: selected ? theme.ink : theme.lineStrong,
                backgroundColor: selected ? theme.ink : theme.surface,
              }}
            >
              {f.color && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: f.color }} />
              )}
              <Text
                numberOfLines={1}
                style={{
                  maxWidth: 150,
                  fontFamily: theme.fonts.semibold,
                  fontSize: 13.5,
                  color: selected ? theme.surface : theme.inkSoft,
                }}
              >
                {f.title}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.medium,
                  fontSize: 12,
                  color: selected ? theme.darkMuted : theme.faint,
                }}
              >
                {f.count}
              </Text>
            </Tap>
          );
        })}
      </ScrollView>
      <Field label="Search tasks, projects, steps, or deadlines" value={query} onChangeText={setQuery} />
      {adding ? (
        <Card>
          <Heading>New task</Heading>
          <TaskEditor
            key={filter}
            initialProjectId={filter !== "all" && filter !== "none" ? filter : null}
            onSave={async (task) => {
              await save("task", task);
              setAdding(false);
            }}
          />
          <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button title="Add task" icon="add" variant="accent" onPress={() => setAdding(true)} />
      )}
      {!!error && <Notice tone="danger">{error}</Notice>}
      {visible.map(renderTask)}
      {!visible.length && (
        <Card style={{ alignItems: "center", paddingVertical: 30 }}>
          <Icon name="taskDone" size={34} color={theme.faint} />
          <Body style={{ textAlign: "center" }}>
            {done.length
              ? "Everything here is done. Nice work."
              : filter === "all"
                ? "Add a task to give your day a clear starting point."
                : "Nothing here yet. Add a task to this project."}
          </Body>
        </Card>
      )}
      {!!done.length && (
        <View style={{ gap: 12, marginTop: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showDone }}
            onPress={() => setShowDone((v) => !v)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 }}
          >
            <Icon name="doneAll" size={19} color={theme.mintDeep} />
            <Text style={{ flex: 1, fontFamily: theme.fonts.bold, fontSize: 15, color: theme.ink }}>
              Completed · {done.length}
            </Text>
            <Icon name={showDone ? "collapse" : "expand"} size={20} color={theme.faint} />
          </Pressable>
          {showDone && (
            <>
              {done.map(renderTask)}
              {!!doneBefore.length &&
                (confirmClear ? (
                  <View style={{ gap: 10, padding: 14, borderRadius: 16, backgroundColor: theme.dangerSoft }}>
                    <Text style={{ fontFamily: theme.fonts.medium, fontSize: 13.5, lineHeight: 20, color: theme.danger }}>
                      Permanently delete {doneBefore.length} completed{" "}
                      {doneBefore.length === 1 ? "task" : "tasks"} from before today? This can’t be undone.
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Button title="Keep them" variant="light" compact style={{ flex: 1 }} onPress={() => setConfirmClear(false)} />
                      <Action
                        title="Delete"
                        busyTitle="Deleting…"
                        icon="delete"
                        compact
                        style={{ flex: 1 }}
                        run={async () => {
                          await removeTasks(doneBefore.map((t) => t.id));
                          setConfirmClear(false);
                        }}
                      />
                    </View>
                  </View>
                ) : (
                  <Button
                    title={`Clear ${doneBefore.length} done before today`}
                    icon="delete"
                    variant="ghost"
                    compact
                    onPress={() => setConfirmClear(true)}
                  />
                ))}
            </>
          )}
        </View>
      )}
    </Screen>
  );
}
