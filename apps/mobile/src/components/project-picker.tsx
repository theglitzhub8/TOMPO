import { useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Icon, Tap, fieldLabel, inputText, theme } from "./ui";
import { useTempo, id, type Project } from "../data/store";

const palette = ["#2B57FF", "#13B07B", "#FF6B1A", "#7B4DFF", "#E5484D", "#0EA5B7"];

/** Stable color per project, derived from its id so no schema change is needed. */
export function projectColor(id: string | null | undefined) {
  if (!id) return theme.faint;
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function ProjectBadge({
  project,
  size = 40,
}: {
  project: Project | null;
  size?: number;
}) {
  const color = projectColor(project?.id);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `${color}1F`,
      }}
    >
      <Icon name={project ? "folder" : "inbox"} size={size * 0.5} color={color} />
    </View>
  );
}

export function ProjectPicker({
  projects,
  value,
  onChange,
  label = "Project",
  disabled = false,
}: {
  projects: Project[];
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  disabled?: boolean;
}) {
  const save = useTempo((s) => s.save);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = async () => {
    const title = name.trim();
    if (!title || busy) return;
    setBusy(true);
    setError("");
    try {
      const project = { id: id(), title };
      await save("project", project);
      onChange(project.id);
      setName("");
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the project.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={fieldLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {projects.map((project) => {
          const selected = project.id === value;
          return (
            <Tap
              key={project.id}
              accessibilityRole="radio"
              accessibilityLabel={project.title}
              accessibilityHint={selected ? "Tap again to remove from this project" : undefined}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(selected ? null : project.id)}
              style={[chip, selected && chipSelected]}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: projectColor(project.id),
                }}
              />
              <Text
                numberOfLines={1}
                style={[chipText, selected && { color: theme.surface }]}
              >
                {project.title}
              </Text>
              {selected && <Icon name="close" size={14} color={theme.darkMuted} />}
            </Tap>
          );
        })}
        {!creating && (
          <Tap
            accessibilityRole="button"
            accessibilityLabel="New project"
            disabled={disabled}
            onPress={() => setCreating(true)}
            style={[chip, { borderStyle: "dashed" }]}
          >
            <Icon name="add" size={15} color={theme.accent} />
            <Text style={[chipText, { color: theme.accent }]}>New project</Text>
          </Tap>
        )}
      </ScrollView>
      {creating && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingLeft: 14,
            paddingRight: 6,
            minHeight: 48,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: theme.ink,
            backgroundColor: theme.surface,
          }}
        >
          <Icon name="folder" size={18} color={theme.muted} />
          <TextInput
            autoFocus
            accessibilityLabel="New project name"
            value={name}
            onChangeText={setName}
            onSubmitEditing={create}
            placeholder="Project name"
            placeholderTextColor={theme.faint}
            maxLength={200}
            style={[inputText, { minHeight: 44, paddingVertical: 10, fontSize: 15 }]}
          />
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Cancel new project"
            onPress={() => {
              setCreating(false);
              setName("");
              setError("");
            }}
            style={roundButton}
          >
            <Icon name="close" size={17} color={theme.muted} />
          </Tap>
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Create project"
            disabled={!name.trim() || busy}
            onPress={create}
            style={[roundButton, { backgroundColor: theme.ink, opacity: name.trim() ? 1 : 0.4 }]}
          >
            <Icon name="check" size={17} color={theme.surface} />
          </Tap>
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ fontFamily: theme.fonts.medium, fontSize: 13, color: theme.danger }}>
          {error}
        </Text>
      )}
    </View>
  );
}

const chip: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  height: 38,
  paddingHorizontal: 14,
  borderRadius: 19,
  borderWidth: 1,
  borderColor: theme.lineStrong,
  backgroundColor: theme.surface,
};
const chipSelected: ViewStyle = { borderColor: theme.ink, backgroundColor: theme.ink };
const chipText: TextStyle = {
  maxWidth: 160,
  fontFamily: theme.fonts.semibold,
  fontSize: 13.5,
  color: theme.inkSoft,
};
const roundButton: ViewStyle = {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: "center",
  justifyContent: "center",
};
