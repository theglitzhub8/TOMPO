import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputInstance } from "react-native";
import {
  Screen,
  Card,
  Field,
  Action,
  Body,
  Button,
  Eyebrow,
  Icon,
  Notice,
  Progress,
  Reveal,
  Tap,
  inputText,
  theme,
} from "../../components/ui";
import { ProjectBadge, projectColor } from "../../components/project-picker";
import { useTempo, id, type Project, type Task } from "../../data/store";

export default function Projects() {
  const { projects, tasks, save } = useTempo();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const assigned = tasks.filter((t) => t.projectId);
  const done = assigned.filter((t) => t.status === "completed").length;
  return (
    <Screen
      eyebrow="WORKSPACE"
      title="Your"
      titleAccent="projects."
      subtitle="Group your tasks by what they’re for, and watch each one move forward."
    >
      <Button title="Shared project spaces" icon="person" variant="secondary" onPress={()=>router.navigate("/team")} />
      {!!projects.length && (
        <Reveal delay={60}>
          <Card dark style={{ gap: 16, padding: 22 }}>
            <Eyebrow light>ACROSS ALL PROJECTS</Eyebrow>
            <View style={{ flexDirection: "row", gap: 24 }}>
              <Figure value={`${projects.length}`} label="Projects" />
              <Figure value={`${assigned.length - done}`} label="Open tasks" />
              <Figure value={`${done}`} label="Done" />
            </View>
            <Progress completed={done} total={assigned.length} dark showLabel={false} />
          </Card>
        </Reveal>
      )}
      {adding ? (
        <Reveal>
          <Card style={{ gap: 14 }}>
            <Field
              label="Project name"
              icon="folder"
              placeholder="e.g. Website launch, Home, Fitness"
              value={title}
              onChangeText={setTitle}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                title="Cancel"
                variant="secondary"
                compact
                style={{ flex: 1 }}
                onPress={() => {
                  setAdding(false);
                  setTitle("");
                }}
              />
              <Action
                title="Create project"
                icon="check"
                compact
                style={{ flex: 1 }}
                run={async () => {
                  const name = title.trim();
                  if (!name) throw new Error("Give your project a name.");
                  const project = { id: id(), title: name };
                  await save("project", project);
                  setTitle("");
                  setAdding(false);
                  setOpen(project.id);
                }}
              />
            </View>
          </Card>
        </Reveal>
      ) : (
        <Button
          title="New project"
          icon="newFolder"
          variant="accent"
          onPress={() => setAdding(true)}
        />
      )}
      {projects.map((project, i) => (
        <Reveal key={project.id} delay={100 + Math.min(i, 6) * 50}>
          <ProjectCard
            project={project}
            tasks={tasks.filter((t) => t.projectId === project.id)}
            open={open === project.id}
            toggle={() => setOpen(open === project.id ? null : project.id)}
          />
        </Reveal>
      ))}
      {!projects.length && !adding && (
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 34 }}>
          <ProjectBadge project={{ id: "empty", title: "" }} size={56} />
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: 26,
              color: theme.ink,
              textAlign: "center",
            }}
          >
            Give your work a home.
          </Text>
          <Body style={{ textAlign: "center", maxWidth: 300 }}>
            Create a project, then add tasks to it here, from your task list,
            or while reviewing a plan.
          </Body>
        </Card>
      )}
    </Screen>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text
        style={{
          fontFamily: theme.fonts.display,
          fontSize: 34,
          lineHeight: 38,
          color: theme.surface,
        }}
      >
        {value}
      </Text>
      <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 12, color: theme.darkMuted }}>
        {label}
      </Text>
    </View>
  );
}

function ProjectCard({
  project,
  tasks,
  open,
  toggle,
}: {
  project: Project;
  tasks: Task[];
  open: boolean;
  toggle: () => void;
}) {
  const { save, removeProject } = useTempo();
  const [name, setName] = useState(project.title);
  const [quick, setQuick] = useState("");
  const quickInput = useRef<TextInputInstance>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const complete = tasks.filter((t) => t.status === "completed").length;
  const pending = tasks.filter((t) => t.status === "pending");
  const color = projectColor(project.id);
  const shown = open ? tasks : pending.slice(0, 3);
  const addTask = async () => {
    const title = quick.trim();
    if (!title) return;
    try {
      await save("task", {
        id: id(),
        title,
        duration: 30,
        projectId: project.id,
        status: "pending",
        completedAt: null,
        scheduledAt: null,
        fixed: false,
      });
      setQuick("");
      setError("");
      quickInput.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that task.");
    }
  };
  const toggleTask = async (task: Task) => {
    try {
      await save("task", {
        ...task,
        status: task.status === "completed" ? "pending" : "completed",
        completedAt: task.status === "completed" ? null : new Date().toISOString(),
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update that task.");
    }
  };
  return (
    <Card style={{ gap: 16, padding: 20 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${open ? "Collapse" : "Open"} ${project.title}`}
        onPress={toggle}
        style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
      >
        <ProjectBadge project={project} size={46} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: theme.fonts.bold,
              fontSize: 17,
              lineHeight: 23,
              color: theme.ink,
              letterSpacing: -0.2,
            }}
          >
            {project.title}
          </Text>
          <Text style={{ fontFamily: theme.fonts.medium, fontSize: 13, color: theme.muted }}>
            {tasks.length
              ? `${complete} of ${tasks.length} done · ${pending.length} remaining`
              : "No tasks yet"}
          </Text>
        </View>
        <Icon name={open ? "collapse" : "expand"} size={22} color={theme.faint} />
      </Pressable>
      {!!tasks.length && (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: tasks.length, now: complete }}
          style={{ height: 6, borderRadius: 3, backgroundColor: theme.surfaceMuted, overflow: "hidden" }}
        >
          <View
            style={{
              height: "100%",
              width: `${Math.round((complete / tasks.length) * 100)}%`,
              borderRadius: 3,
              backgroundColor: color,
            }}
          />
        </View>
      )}
      {!!shown.length && (
        <View style={{ gap: 2 }}>
          {shown.map((task) => {
            const isDone = task.status === "completed";
            return (
              <Pressable
                key={task.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`Complete ${task.title}`}
                accessibilityState={{ checked: isDone }}
                onPress={() => toggleTask(task)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 44,
                  paddingHorizontal: 6,
                  borderRadius: 12,
                  backgroundColor: pressed ? theme.background : "transparent",
                })}
              >
                <Icon
                  name={isDone ? "checkCircle" : "circle"}
                  size={22}
                  color={isDone ? color : theme.faint}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontFamily: theme.fonts.medium,
                    fontSize: 15,
                    color: isDone ? theme.faint : theme.ink,
                    textDecorationLine: isDone ? "line-through" : "none",
                  }}
                >
                  {task.title}
                </Text>
                <Text style={{ fontFamily: theme.fonts.medium, fontSize: 12, color: theme.faint }}>
                  {task.duration} min
                </Text>
              </Pressable>
            );
          })}
          {!open && pending.length > 3 && (
            <Text
              onPress={toggle}
              style={{
                fontFamily: theme.fonts.semibold,
                fontSize: 13,
                color: theme.accent,
                paddingHorizontal: 6,
                paddingTop: 6,
              }}
            >
              +{pending.length - 3} more
            </Text>
          )}
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingLeft: 14,
          paddingRight: 6,
          minHeight: 50,
          borderRadius: 16,
          backgroundColor: theme.background,
        }}
      >
        <Icon name="add" size={19} color={theme.faint} />
        <TextInput
          ref={quickInput}
          accessibilityLabel={`Add a task to ${project.title}`}
          value={quick}
          onChangeText={setQuick}
          onSubmitEditing={addTask}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder="Add a task"
          placeholderTextColor={theme.faint}
          style={[inputText, { minHeight: 48, paddingVertical: 12, fontSize: 15 }]}
        />
        {!!quick.trim() && (
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Add task"
            onPress={addTask}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.ink,
            }}
          >
            <Icon name="arrow" size={18} color={theme.surface} />
          </Tap>
        )}
      </View>
      {!!error && <Notice tone="danger">{error}</Notice>}
      {open && (
        <View style={{ gap: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: theme.line }}>
          <View style={{ height: 4 }} />
          <Field label="Rename project" icon="edit" value={name} onChangeText={setName} />
          <Action
            title="Save name"
            icon="check"
            variant="secondary"
            compact
            run={async () => {
              const title = name.trim();
              if (!title) throw new Error("Give your project a name.");
              await save("project", { ...project, title });
            }}
          />
          {confirmDelete ? (
            <View style={{ gap: 10, padding: 14, borderRadius: 16, backgroundColor: theme.dangerSoft }}>
              <Text style={{ fontFamily: theme.fonts.medium, fontSize: 13.5, lineHeight: 20, color: theme.danger }}>
                Delete “{project.title}”? Its {tasks.length}{" "}
                {tasks.length === 1 ? "task stays" : "tasks stay"} in your task
                list.
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button
                  title="Keep it"
                  variant="light"
                  compact
                  style={{ flex: 1 }}
                  onPress={() => setConfirmDelete(false)}
                />
                <Action
                  title="Delete"
                  busyTitle="Deleting…"
                  icon="delete"
                  variant="primary"
                  compact
                  style={{ flex: 1 }}
                  run={() => removeProject(project.id)}
                />
              </View>
            </View>
          ) : (
            <Button
              title="Delete project"
              icon="delete"
              variant="ghost"
              compact
              onPress={() => setConfirmDelete(true)}
            />
          )}
        </View>
      )}
    </Card>
  );
}
