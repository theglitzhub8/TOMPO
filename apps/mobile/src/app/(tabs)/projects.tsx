import { useState } from "react";
import {
  Screen,
  Card,
  Field,
  Action,
  Heading,
  Body,
  Progress,
  Button,
} from "../../components/ui";
import { useTempo, id, type Project } from "../../data/store";
import { Pressable } from "react-native";
export default function Projects() {
  const { projects, tasks, save } = useTempo();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  return (
    <Screen
      eyebrow="WORKSPACE"
      title="Your projects"
      subtitle="Keep everything organized and finish what you start."
    >
      {projects.map((project) => {
        const assigned = tasks.filter((t) => t.projectId === project.id);
        const complete = assigned.filter(
          (t) => t.status === "completed",
        ).length;
        return (
          <Card key={project.id} style={{ minHeight: 160 }}>
            <CardTitle
              project={project}
              onPress={() =>
                setEditing(editing === project.id ? null : project.id)
              }
            />
            <Body>
              {assigned.length} tasks · {assigned.length - complete} remaining
            </Body>
            <Progress completed={complete} total={assigned.length} />
            {editing === project.id && (
              <ProjectEditor project={project} close={() => setEditing(null)} />
            )}
          </Card>
        );
      })}
      {!projects.length && (
        <Card>
          <Body>Your workspace is ready. Add your first project.</Body>
        </Card>
      )}
      {adding && (
        <Card>
          <Field label="Project name" value={title} onChangeText={setTitle} />
          <Action
            title="Create project"
            run={async () => {
              await save("project", { id: id(), title: title.trim() });
              setTitle("");
              setAdding(false);
            }}
          />
        </Card>
      )}
      <Button
        title={adding ? "Cancel new project" : "+ Add project"}
        onPress={() => setAdding(!adding)}
      />
    </Screen>
  );
}
function CardTitle({
  project,
  onPress,
}: {
  project: Project;
  onPress: () => void;
}) {
  return <ButtonLink title={`◈  ${project.title}`} onPress={onPress} />;
}
function ButtonLink({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${title}`}
      onPress={onPress}
    >
      <Heading>{title}</Heading>
    </Pressable>
  );
}
function ProjectEditor({
  project,
  close,
}: {
  project: Project;
  close: () => void;
}) {
  const [title, setTitle] = useState(project.title);
  const save = useTempo((s) => s.save);
  return (
    <>
      <Field label="Rename project" value={title} onChangeText={setTitle} />
      <Action
        title="Save project"
        run={async () => {
          await save("project", { ...project, title: title.trim() });
          close();
        }}
      />
    </>
  );
}
