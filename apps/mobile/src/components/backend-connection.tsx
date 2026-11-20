import { useState } from "react";
import { Text, View } from "react-native";
import {
  Action,
  Avatar,
  Button,
  Card,
  Chip,
  Field,
  Group,
  ListRow,
  Reveal,
  theme,
} from "./ui";
import { useTempo } from "../data/store";
export function BackendConnection() {
  const { user, lastSavedAt, pending, updateName } = useTempo();
  const [name, setName] = useState(user?.name || "");
  const [editing, setEditing] = useState(false);
  if (!user) return null;
  return (
    <>
      <Reveal delay={60}>
        <Card dark style={{ padding: 22, gap: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Avatar name={user.name} size={60} dark />
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: theme.fonts.display,
                  fontSize: 30,
                  lineHeight: 34,
                  color: theme.surface,
                }}
              >
                {user.name}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: theme.fonts.medium,
                  fontSize: 14,
                  color: theme.darkMuted,
                }}
              >
                {user.email}
              </Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Chip icon={pending ? "sync" : "cloud"} tone="dark">
              {pending
                ? "Saving to your account…"
                : "Your saved plan is stored online in your account."}
            </Chip>
            {!!lastSavedAt && (
              <Text
                style={{
                  fontFamily: theme.fonts.regular,
                  fontSize: 12,
                  color: theme.darkMuted,
                  marginLeft: 4,
                }}
              >
                Last checked: {new Date(lastSavedAt).toLocaleString()}
              </Text>
            )}
          </View>
        </Card>
      </Reveal>
      <Group title="PROFILE">
        <ListRow
          icon="person"
          title="Your name"
          detail={user.name}
          onPress={() => setEditing((v) => !v)}
          last={!editing}
        />
        {editing && (
          <View style={{ padding: 18, gap: 14 }}>
            <Field label="Your name" icon="person" value={name} onChangeText={setName} />
            <Action
              title="Save profile"
              icon="check"
              run={async () => {
                await updateName(name.trim());
                setEditing(false);
              }}
            />
          </View>
        )}
      </Group>
    </>
  );
}

export function AccountActions() {
  const { user, reload, signOut, deleteAccount } = useTempo();
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  if (!user) return null;
  return (
    <Group title="ACCOUNT">
      <View style={{ padding: 18, gap: 12 }}>
        <Action
          title="Refresh saved plan"
          busyTitle="Refreshing…"
          icon="sync"
          variant="secondary"
          run={reload}
        />
        <Action
          title="Sign out"
          busyTitle="Signing out…"
          icon="logout"
          variant="danger"
          run={signOut}
        />
        <Text
          style={{
            fontFamily: theme.fonts.regular,
            fontSize: 12.5,
            lineHeight: 18,
            color: theme.muted,
          }}
        >
          Signing out clears your plan from this app’s memory. Sign back in
          to restore it from your account.
        </Text>
        {deleting ? (
          <View style={{ gap: 10, padding: 14, borderRadius: 16, backgroundColor: theme.dangerSoft }}>
            <Text style={{ fontFamily: theme.fonts.bold, fontSize: 14.5, color: theme.danger }}>
              Delete your account?
            </Text>
            <Text style={{ fontFamily: theme.fonts.regular, fontSize: 13.5, lineHeight: 20, color: theme.inkSoft }}>
              This permanently deletes your account, tasks, projects, weekly
              schedule, shared tasks and comments from Tempo’s servers. It
              can’t be undone.
            </Text>
            <Field label="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                title="Keep it"
                variant="light"
                compact
                style={{ flex: 1 }}
                onPress={() => {
                  setDeleting(false);
                  setConfirm("");
                }}
              />
              <Action
                title="Delete forever"
                busyTitle="Deleting…"
                icon="delete"
                variant="danger"
                compact
                style={{ flex: 1 }}
                run={async () => {
                  if (confirm.trim() !== "DELETE") throw new Error("Type DELETE in capitals to confirm.");
                  await deleteAccount();
                }}
              />
            </View>
          </View>
        ) : (
          <Button
            title="Delete account"
            icon="delete"
            variant="ghost"
            compact
            style={{ alignSelf: "flex-start" }}
            onPress={() => setDeleting(true)}
          />
        )}
      </View>
    </Group>
  );
}
