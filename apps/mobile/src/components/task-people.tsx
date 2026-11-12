import { TaskComments } from "./task-comments";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Avatar, Chip, Icon, Tap, fieldLabel, inputText, theme } from "./ui";
import { useTempo, type Task } from "../data/store";

const statusLabel = {
  pending: { text: "Invited", tone: "neutral" },
  accepted: { text: "Joined", tone: "mint" },
  declined: { text: "Declined", tone: "accent" },
} as const;

/** Add teammates to one of your tasks. It appears on their Today once they accept. */
export function TaskPeople({ task }: { task: Task }) {
  const { user, shares, invite, removeShare } = useTempo();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const people = shares.outgoing.filter((s) => s.taskId === task.id);
  // Everyone you've worked with before, for one-tap adding.
  const known = new Map<string, string>();
  for (const s of shares.outgoing) known.set(s.email, s.name);
  for (const s of shares.incoming) known.set(s.ownerEmail, s.ownerName);
  const suggestions = [...known].filter(
    ([address]) => address !== user?.email && !people.some((p) => p.email === address),
  );
  const add = async (address: string) => {
    const value = address.trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    try {
      await invite(task.id, value);
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that person.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 12 }}>
      {user && <TaskComments ownerId={user.id} taskId={task.id} />}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="person" size={18} color={theme.accent} />
        <Text style={[fieldLabel, { marginLeft: 0, fontSize: 14, color: theme.ink }]}>
          People on this task
        </Text>
      </View>
      {people.map((person) => (
        <View
          key={person.memberId}
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <Avatar name={person.name} size={36} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text
              numberOfLines={1}
              style={{ fontFamily: theme.fonts.semibold, fontSize: 14.5, color: theme.ink }}
            >
              {person.name}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontFamily: theme.fonts.regular, fontSize: 12.5, color: theme.muted }}
            >
              {person.email}
            </Text>
          </View>
          <Chip tone={statusLabel[person.status].tone}>
            {statusLabel[person.status].text}
          </Chip>
          <Tap
            accessibilityRole="button"
            accessibilityLabel={`Remove ${person.name}`}
            hitSlop={8}
            onPress={async () => {
              try {
                await removeShare(user!.id, task.id, person.memberId);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not remove them.");
              }
            }}
            style={{ padding: 6 }}
          >
            <Icon name="close" size={18} color={theme.faint} />
          </Tap>
        </View>
      ))}
      {!!suggestions.length && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {suggestions.map(([address, name]) => (
            <Tap
              key={address}
              accessibilityRole="button"
              accessibilityLabel={`Add ${name}`}
              disabled={busy}
              onPress={() => add(address)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                height: 38,
                paddingLeft: 4,
                paddingRight: 12,
                borderRadius: 19,
                borderWidth: 1,
                borderColor: theme.lineStrong,
                backgroundColor: theme.surface,
              }}
            >
              <Avatar name={name} size={30} />
              <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 13, color: theme.inkSoft }}>
                {name.split(/\s+/)[0]}
              </Text>
              <Icon name="add" size={15} color={theme.accent} />
            </Tap>
          ))}
        </ScrollView>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingLeft: 14,
          paddingRight: 6,
          minHeight: 52,
          borderRadius: 16,
          backgroundColor: theme.background,
        }}
      >
        <Icon name="mail" size={18} color={theme.faint} />
        <TextInput
          accessibilityLabel="Teammate’s email"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => add(email)}
          placeholder="Teammate’s email"
          placeholderTextColor={theme.faint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          maxLength={254}
          style={[inputText, { minHeight: 50, paddingVertical: 12, fontSize: 15 }]}
        />
        <Tap
          accessibilityRole="button"
          accessibilityLabel="Add teammate"
          disabled={!email.trim() || busy}
          onPress={() => add(email)}
          style={{
            height: 40,
            paddingHorizontal: 16,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.ink,
            opacity: email.trim() && !busy ? 1 : 0.4,
          }}
        >
          <Text style={{ fontFamily: theme.fonts.bold, fontSize: 13.5, color: theme.surface }}>
            {busy ? "Adding…" : "Add"}
          </Text>
        </Tap>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={{ fontFamily: theme.fonts.medium, fontSize: 13, lineHeight: 19, color: theme.danger }}>
          {error}
        </Text>
      ) : (
        <Text style={{ fontFamily: theme.fonts.regular, fontSize: 12.5, lineHeight: 18, color: theme.muted }}>
          They need a Tempo account. Once they accept, it shows on their Today at
          the same time, and either of you can mark it done.
        </Text>
      )}
    </View>
  );
}

/** Small overlapping avatars for the people on a task. */
export function PeopleStack({ names, size = 24 }: { names: string[]; size?: number }) {
  if (!names.length) return null;
  return (
    <View style={{ flexDirection: "row" }}>
      {names.slice(0, 3).map((name, i) => (
        <View
          key={`${name}-${i}`}
          style={{
            marginLeft: i ? -size * 0.3 : 0,
            borderRadius: size,
            borderWidth: 2,
            borderColor: theme.surface,
          }}
        >
          <Avatar name={name} size={size} />
        </View>
      ))}
      {names.length > 3 && (
        <Text style={{ marginLeft: 4, alignSelf: "center", fontFamily: theme.fonts.semibold, fontSize: 11.5, color: theme.muted }}>
          +{names.length - 3}
        </Text>
      )}
    </View>
  );
}
