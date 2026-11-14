import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Action, Field, Icon, Tap, theme } from "./ui";
import { useTempo, type Preferences } from "../data/store";
import { setSoundsEnabled, soundsEnabled } from "../lib/celebrate";

const levels: { mode: Preferences["mode"]; title: string; detail: string }[] = [
  { mode: "Gentle", title: "Gentle", detail: "A heads-up 30 minutes before, and a reminder when it starts." },
  { mode: "Firm", title: "Firm", detail: "Plus a nudge 5 minutes in if you haven’t started." },
  { mode: "Strict", title: "Strict", detail: "Plus an urgent check-in at 15 minutes that gets through Focus mode. No silent skipping." },
];

/** How hard Tempo pushes, and the treat for finishing. */
export function DriveSettings() {
  const { preferences, save } = useTempo();
  const [treat, setTreat] = useState(preferences.treat ?? "");
  const [sounds, setSounds] = useState(true);
  useEffect(() => {
    void soundsEnabled().then(setSounds);
  }, []);
  return (
    <View style={{ padding: 16, gap: 14 }}>
      <View style={{ gap: 8 }}>
        {levels.map((l) => {
          const on = preferences.mode === l.mode;
          return (
            <Tap
              key={l.mode}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => void save("preferences", { ...preferences, mode: l.mode }).catch(() => undefined)}
              style={{
                flexDirection: "row",
                gap: 12,
                padding: 14,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: on ? theme.accent : theme.line,
                backgroundColor: on ? theme.accentSoft : theme.surface,
              }}
            >
              <Icon name={on ? "checkCircle" : "circle"} size={22} color={on ? theme.accent : theme.faint} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: theme.fonts.bold, fontSize: 15, color: theme.ink }}>{l.title}</Text>
                <Text style={{ fontFamily: theme.fonts.regular, fontSize: 13, lineHeight: 19, color: theme.muted }}>{l.detail}</Text>
              </View>
            </Tap>
          );
        })}
      </View>
      <Field
        label="Your treat for finishing the day"
        icon="sparkle"
        placeholder="30 min of FIFA, an episode, ice cream…"
        value={treat}
        onChangeText={setTreat}
      />
      {treat.trim() !== (preferences.treat ?? "") && (
        <Action
          title="Save my treat"
          icon="check"
          compact
          run={async () => {
            const value = treat.trim().slice(0, 120);
            await save("preferences", { ...preferences, ...(value ? { treat: value } : { treat: undefined }) });
          }}
        />
      )}
      <Tap
        accessibilityRole="switch"
        accessibilityState={{ checked: sounds }}
        onPress={() => {
          setSounds(!sounds);
          void setSoundsEnabled(!sounds);
        }}
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <Icon name="wave" size={20} color={theme.accent} />
        <Text style={{ flex: 1, fontFamily: theme.fonts.semibold, fontSize: 14.5, color: theme.ink }}>Celebration sounds</Text>
        <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: sounds ? theme.progress : theme.surfaceMuted, alignItems: sounds ? "flex-end" : "flex-start" }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: theme.surface }} />
        </View>
      </Tap>
    </View>
  );
}
