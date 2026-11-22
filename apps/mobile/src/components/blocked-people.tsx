import { useState } from "react";
import { Text, View } from "react-native";
import { Action, Body, Group } from "./ui";
import { useTempo } from "../data/store";
import { theme } from "../design/tokens";
type Person = { id: string; name: string };
/** Settings list of people this account blocked, with a way to unblock them. */
export function BlockedPeople() {
  const cloud = useTempo((s) => s.cloudRequest);
  const user = useTempo((s) => s.user);
  const [people, setPeople] = useState<Person[] | null>(null);
  if (!user) return null;
  const load = async () =>
    setPeople((await cloud<{ people: Person[] }>("/v1/team/blocked")).people);
  return (
    <Group title="BLOCKED PEOPLE">
      <View style={{ padding: 18, gap: 12 }}>
        <Body small>
          People you block can’t invite you, and you won’t see their comments.
        </Body>
        {people === null ? (
          <Action title="Show blocked people" variant="secondary" compact run={load} busyTitle="Loading…" />
        ) : !people.length ? (
          <Body small>You haven’t blocked anyone.</Body>
        ) : (
          people.map((p) => (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ flex: 1, fontFamily: theme.fonts.medium, fontSize: 15, color: theme.ink }}>{p.name}</Text>
              <Action
                title="Unblock"
                variant="ghost"
                compact
                busyTitle="Unblocking…"
                run={async () => {
                  await cloud("/v1/team/unblock", { userId: p.id });
                  await load();
                }}
              />
            </View>
          ))
        )}
      </View>
    </Group>
  );
}
