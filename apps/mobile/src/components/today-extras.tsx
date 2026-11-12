import { useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Avatar, Chip, Icon, Reveal, Tap, theme, type IconName } from "./ui";
import { ProjectBadge, projectColor } from "./project-picker";
import { useTempo, type IncomingShare, type Task } from "../data/store";
import { shadow } from "../design/tokens";
import { localParts } from "../../../../packages/core/src/scheduling";

function when(share: IncomingShare, timezone: string) {
  const at = share.task.scheduledAt;
  if (!at) return share.task.plannedDay ? `Planned for ${share.task.plannedDay}` : "Flexible time";
  const parts = localParts(new Date(at), timezone);
  const today = localParts(new Date(), timezone).date;
  const day =
    parts.date === today
      ? "Today"
      : new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          weekday: "short",
          month: "short",
          day: "numeric",
        }).format(new Date(at));
  return `${day} · ${parts.clock}`;
}

export function SectionTitle({
  icon,
  title,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
      <Icon name={icon} size={19} color={theme.accent} />
      <Text
        accessibilityRole="header"
        style={{ flex: 1, fontFamily: theme.fonts.bold, fontSize: 17, color: theme.ink, letterSpacing: -0.2 }}
      >
        {title}
      </Text>
      {action && onAction && (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 13.5, color: theme.accent }}>
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Teammates asking you to join a task. */
export function Invitations() {
  const { shares, preferences, respondShare } = useTempo();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pending = shares.incoming.filter((s) => s.status === "pending");
  if (!pending.length) return null;
  const respond = async (share: IncomingShare, accept: boolean) => {
    const key = `${share.ownerId}:${share.taskId}`;
    setBusy(key);
    setError("");
    try {
      await respondShare(share.ownerId, share.taskId, accept);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not answer that invitation.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Reveal style={{ gap: 10 }}>
      {pending.map((share) => {
        const key = `${share.ownerId}:${share.taskId}`;
        return (
          <View
            key={key}
            style={{
              padding: 16,
              gap: 14,
              borderRadius: 22,
              backgroundColor: theme.surface,
              borderWidth: 1.5,
              borderColor: theme.accent,
              ...shadow.soft,
            }}
          >
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Avatar name={share.ownerName} size={42} dark />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: theme.fonts.medium, fontSize: 13, color: theme.muted }}>
                  {share.ownerName} added you to
                </Text>
                <Text style={{ fontFamily: theme.fonts.bold, fontSize: 16, lineHeight: 21, color: theme.ink }}>
                  {share.task.title}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <Chip icon="calendar">{when(share, preferences.timezone)}</Chip>
              <Chip icon="timer">{share.task.duration} min</Chip>
              {share.projectTitle && <Chip icon="folder">{share.projectTitle}</Chip>}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`Decline ${share.task.title}`}
                disabled={busy === key}
                onPress={() => respond(share, false)}
                style={[pill, { backgroundColor: theme.background }]}
              >
                <Text style={[pillText, { color: theme.inkSoft }]}>Decline</Text>
              </Tap>
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`Accept ${share.task.title}`}
                disabled={busy === key}
                onPress={() => respond(share, true)}
                style={[pill, { backgroundColor: theme.ink }]}
              >
                <Icon name="check" size={17} color={theme.surface} />
                <Text style={[pillText, { color: theme.surface }]}>
                  {busy === key ? "Saving…" : "Add to my day"}
                </Text>
              </Tap>
            </View>
          </View>
        );
      })}
      {!!error && (
        <Text accessibilityRole="alert" style={{ fontFamily: theme.fonts.medium, fontSize: 13, color: theme.danger }}>
          {error}
        </Text>
      )}
    </Reveal>
  );
}

/** Tasks teammates have shared with you and you've accepted. */
export function TeamTasks() {
  const { shares, preferences, setSharedDone, removeShare, user } = useTempo();
  const [error, setError] = useState("");
  const accepted = shares.incoming
    .filter((s) => s.status === "accepted")
    .sort(
      (a, b) =>
        Number(a.task.status === "completed") - Number(b.task.status === "completed") ||
        (a.task.scheduledAt || "z").localeCompare(b.task.scheduledAt || "z"),
    );
  if (!accepted.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <SectionTitle icon="person" title="With your team" />
      <View
        style={{
          borderRadius: 22,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          overflow: "hidden",
          ...shadow.soft,
        }}
      >
        {accepted.map((share, i) => {
          const isDone = share.task.status === "completed";
          return (
            <View
              key={`${share.ownerId}:${share.taskId}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: theme.line,
              }}
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`Complete ${share.task.title}`}
                accessibilityState={{ checked: isDone }}
                hitSlop={8}
                onPress={async () => {
                  try {
                    setError("");
                    await setSharedDone(share.ownerId, share.taskId, !isDone);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not update that task.");
                  }
                }}
              >
                <Icon
                  name={isDone ? "checkCircle" : "circle"}
                  size={26}
                  color={isDone ? theme.mintDeep : theme.faint}
                />
              </Pressable>
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{
                    fontFamily: theme.fonts.semibold,
                    fontSize: 15,
                    color: isDone ? theme.faint : theme.ink,
                    textDecorationLine: isDone ? "line-through" : "none",
                  }}
                >
                  {share.task.title}
                </Text>
                <Text style={{ fontFamily: theme.fonts.medium, fontSize: 12.5, color: theme.muted }}>
                  {when(share, preferences.timezone)} · with {share.ownerName.split(/\s+/)[0]}
                  {share.projectTitle ? ` · ${share.projectTitle}` : ""}
                </Text>
              </View>
              <Avatar name={share.ownerName} size={30} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Leave ${share.task.title}`}
                hitSlop={8}
                onPress={async () => {
                  try {
                    setError("");
                    await removeShare(share.ownerId, share.taskId, user!.id);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not leave that task.");
                  }
                }}
              >
                <Icon name="close" size={18} color={theme.faint} />
              </Pressable>
            </View>
          );
        })}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={{ fontFamily: theme.fonts.medium, fontSize: 13, color: theme.danger }}>
          {error}
        </Text>
      )}
    </View>
  );
}

/** A horizontal glance at every project's progress. */
export function ProjectStrip() {
  const { projects, tasks } = useTempo();
  return (
    <View style={{ gap: 12 }}>
      <SectionTitle
        icon="folder"
        title="Your projects"
        action={projects.length ? "See all" : undefined}
        onAction={() => router.navigate("/projects")}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingRight: 20, paddingVertical: 4 }}
        style={{ marginHorizontal: -20, paddingLeft: 20 }}
      >
        {projects.map((project) => {
          const own = tasks.filter((t) => t.projectId === project.id);
          const done = own.filter((t) => t.status === "completed").length;
          const percent = own.length ? Math.round((done / own.length) * 100) : 0;
          return (
            <Tap
              key={project.id}
              accessibilityRole="button"
              accessibilityLabel={`${project.title}, ${percent}% done`}
              onPress={() => router.navigate("/projects")}
              style={{
                width: 172,
                padding: 16,
                gap: 14,
                borderRadius: 22,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                ...shadow.soft,
              }}
            >
              <ProjectBadge project={project} size={36} />
              <View style={{ gap: 3 }}>
                <Text numberOfLines={1} style={{ fontFamily: theme.fonts.bold, fontSize: 15, color: theme.ink }}>
                  {project.title}
                </Text>
                <Text style={{ fontFamily: theme.fonts.medium, fontSize: 12.5, color: theme.muted }}>
                  {own.length - done} open · {percent}%
                </Text>
              </View>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: theme.surfaceMuted, overflow: "hidden" }}>
                <View
                  style={{
                    height: "100%",
                    width: `${percent}%`,
                    borderRadius: 3,
                    backgroundColor: projectColor(project.id),
                  }}
                />
              </View>
            </Tap>
          );
        })}
        <Tap
          accessibilityRole="button"
          accessibilityLabel="New project"
          onPress={() => router.navigate("/projects")}
          style={{
            width: 140,
            padding: 16,
            gap: 10,
            borderRadius: 22,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: theme.lineStrong,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="newFolder" size={26} color={theme.accent} />
          <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 13.5, color: theme.accent, textAlign: "center" }}>
            New project
          </Text>
        </Tap>
      </ScrollView>
    </View>
  );
}

/** What you've already finished today. Older completed work lives under Tasks › Completed. */
export function DoneToday({ tasks }: { tasks: Task[] }) {
  const [open, setOpen] = useState(false);
  if (!tasks.length) return null;
  return (
    <View
      style={{
        padding: 16,
        gap: 12,
        borderRadius: 22,
        backgroundColor: theme.mintSoft,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <Icon name="doneAll" size={20} color={theme.mintDeep} />
        <Text style={{ flex: 1, fontFamily: theme.fonts.bold, fontSize: 15, color: theme.mintDeep }}>
          {tasks.length} done today
        </Text>
        <Icon name={open ? "collapse" : "expand"} size={20} color={theme.mintDeep} />
      </Pressable>
      {open &&
        tasks.map((t) => (
          <View key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name="check" size={16} color={theme.mintDeep} />
            <Text style={{ flex: 1, fontFamily: theme.fonts.medium, fontSize: 14, color: theme.inkSoft }}>
              {t.title}
            </Text>
          </View>
        ))}
    </View>
  );
}

const pill = {
  flex: 1,
  height: 46,
  borderRadius: 23,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 8,
};
const pillText = { fontFamily: theme.fonts.bold, fontSize: 14 };
