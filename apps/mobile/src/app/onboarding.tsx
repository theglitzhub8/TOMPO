import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Action, Button, Icon, Tap } from "../components/ui";
import { Orb } from "../components/orb";
import { levels } from "../components/drive-settings";
import { talk } from "../components/helper";
import { theme, gradient, gradients } from "../design/tokens";
import { useTempo, type Preferences } from "../data/store";
import { enableReminders, remindersSupported } from "../lib/reminders";

const treats = ["An episode of my show", "30 min of gaming", "Something sweet", "A walk outside", "Time with friends"];
const steps = ["hello", "push", "treat", "reminders", "week", "today"] as const;

/** First run: a short setup so Tempo knows how to work with this person. */
export default function Onboarding() {
  const preferences = useTempo((s) => s.preferences);
  const firstName = useTempo((s) => s.user?.name.trim().split(/\s+/)[0] ?? "");
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Preferences["mode"]>(preferences.mode || "Firm");
  const [treat, setTreat] = useState(preferences.treat ?? "");
  const [reminders, setReminders] = useState("");
  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  // Saves everything chosen so far and leaves setup for good.
  const finish = async (then: () => void) => {
    const value = treat.trim().slice(0, 120);
    await useTempo.getState().save("preferences", {
      ...useTempo.getState().preferences,
      mode,
      ...(value ? { treat: value } : {}),
      onboardingComplete: true,
    });
    router.replace("/");
    then();
  };
  const name = steps[step];
  return (
    <View style={[{ flex: 1, backgroundColor: theme.night }, gradient(gradients.nightGlow)]}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 8 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {steps.map((s, i) => (
              <View key={s} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? theme.accent : theme.darkTrack }} />
            ))}
          </View>
          {name !== "today" && (
            <Text
              accessibilityRole="button"
              onPress={() => void finish(() => undefined)}
              style={{ fontFamily: theme.fonts.semibold, fontSize: 14, color: theme.darkMuted, padding: 8 }}
            >
              Skip setup
            </Text>
          )}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", gap: 22, padding: 24, maxWidth: 520, width: "100%", alignSelf: "center" }}
        >
          <Orb size={name === "hello" ? 96 : 56} active={name === "hello"} />
          {name === "hello" && (
            <>
              <Title>{`Hi${firstName ? ` ${firstName}` : ""}. I’m Tempo.`}</Title>
              <Lead>Tell me what you need to do, in your own words. I’ll turn it into a plan, and then I’ll make sure it actually gets done.</Lead>
              <Lead>Let’s take one minute so I know how to work with you.</Lead>
              <Button title="Let’s go" icon="arrow" variant="accent" onPress={next} />
            </>
          )}
          {name === "push" && (
            <>
              <Title>How hard should I push you?</Title>
              <Lead>You can change this any time in Me.</Lead>
              <View style={{ gap: 10 }}>
                {levels.map((l) => {
                  const on = mode === l.mode;
                  return (
                    <Tap
                      key={l.mode}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => setMode(l.mode)}
                      style={{ flexDirection: "row", gap: 12, padding: 16, borderRadius: 18, borderWidth: 1.5, borderColor: on ? theme.accent : theme.darkLine, backgroundColor: on ? "rgba(43,87,255,0.18)" : "rgba(255,255,255,0.05)" }}
                    >
                      <Icon name={on ? "checkCircle" : "circle"} size={22} color={on ? theme.mint : theme.darkMuted} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontFamily: theme.fonts.bold, fontSize: 16, color: theme.surface }}>
                          {l.title}
                          {l.mode === "Firm" ? "  · recommended" : ""}
                        </Text>
                        <Text style={{ fontFamily: theme.fonts.regular, fontSize: 13.5, lineHeight: 19, color: theme.darkMuted }}>{l.detail}</Text>
                      </View>
                    </Tap>
                  );
                })}
              </View>
              <Button title="Next" icon="arrow" variant="accent" onPress={next} />
            </>
          )}
          {name === "treat" && (
            <>
              <Title>What’s your treat for finishing the day?</Title>
              <Lead>Something you’ll look forward to. I’ll remind you of it when the last task is done.</Lead>
              <TextInput
                accessibilityLabel="Your treat"
                value={treat}
                onChangeText={setTreat}
                placeholder="Type your own, or pick one below"
                placeholderTextColor={theme.darkMuted}
                maxLength={120}
                style={{ minHeight: 54, paddingHorizontal: 18, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: theme.darkLine, color: theme.surface, fontFamily: theme.fonts.medium, fontSize: 16 }}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {treats.map((t) => (
                  <Tap
                    key={t}
                    accessibilityRole="button"
                    onPress={() => setTreat(t)}
                    style={{ paddingHorizontal: 14, height: 38, justifyContent: "center", borderRadius: 19, backgroundColor: treat === t ? theme.accent : "rgba(255,255,255,0.08)" }}
                  >
                    <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 13.5, color: theme.surface }}>{t}</Text>
                  </Tap>
                ))}
              </View>
              <Button title={treat.trim() ? "Next" : "Skip this"} icon="arrow" variant="accent" onPress={next} />
            </>
          )}
          {name === "reminders" && (
            <>
              <Title>Let me reach you.</Title>
              <Lead>
                {mode === "Gentle"
                  ? "I’ll give you a heads-up before each task and a reminder when it starts."
                  : mode === "Firm"
                    ? "I’ll give you a heads-up, a reminder when it starts, and a nudge if you haven’t started."
                    : "I’ll give you a heads-up, a start reminder, a nudge, and an urgent check-in if you still haven’t started."}{" "}
                For that I need notifications.
              </Lead>
              {!!reminders && <Lead>{reminders}</Lead>}
              {remindersSupported && !reminders ? (
                <Action
                  title="Turn on reminders"
                  icon="bell"
                  variant="accent"
                  busyTitle="One moment…"
                  run={async () => {
                    const status = await enableReminders();
                    setReminders(status === "on" ? "Reminders are on." : "Reminders are off. You can allow them later in Me.");
                    if (status === "on") next();
                  }}
                />
              ) : (
                <Button title="Next" icon="arrow" variant="accent" onPress={next} />
              )}
              {!reminders && <Button title="Not now" variant="ghost" onPress={next} style={{ opacity: 0.85 }} />}
            </>
          )}
          {name === "week" && (
            <>
              <Title>What happens every week?</Title>
              <Lead>Class, work, gym, church: tell me once and I’ll plan everything else around it, and warn you before anything clashes.</Lead>
              <Action title="Tell Tempo my week" icon="mic" variant="accent" run={() => finish(() => talk(undefined, "week"))} />
              <Button title="Later" variant="ghost" onPress={next} style={{ opacity: 0.85 }} />
            </>
          )}
          {name === "today" && (
            <>
              <Title>You’re set. What’s on today?</Title>
              <Lead>Just talk. Everything you need to do, in any order, with times if you know them.</Lead>
              <Action title="Plan my day" icon="mic" variant="accent" run={() => finish(() => talk())} />
              <Action title="Look around first" variant="light" run={() => finish(() => undefined)} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Title({ children }: { children: string }) {
  return <Text style={{ fontFamily: theme.fonts.display, fontSize: 42, lineHeight: 44, color: theme.surface }}>{children}</Text>;
}

function Lead({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: theme.fonts.regular, fontSize: 16.5, lineHeight: 25, color: theme.darkMuted }}>{children}</Text>;
}
