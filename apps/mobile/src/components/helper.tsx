import { useEffect, useState } from "react";
import { Animated, Easing, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Icon, Tap, theme, type IconName } from "./ui";
import { Orb } from "./orb";
import { shadow } from "../design/tokens";
import type { Task } from "../data/store";

const native = Platform.OS !== "web";

export type Suggestion = {
  label: string;
  icon: IconName;
  /** Opens Talk to Tempo and sends these words. */
  say?: string;
  /** Runs on the device and returns what Tempo says back. */
  run?: () => Promise<string>;
  /** Opens Talk to Tempo in project setup. */
  project?: boolean;
};

/** Opens the assistant, optionally sending a first message. */
export const talk = (say?: string, focus?: "project" | "week") =>
  router.navigate({
    pathname: "/talk",
    params: { ...(say ? { say } : {}), ...(focus ? { focus } : {}) },
  });

const span = (minutes: number) =>
  minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;

/** What Tempo says on Today, from the state of the day. */
export function helperMessage(input: {
  name: string;
  hour: number;
  isToday: boolean;
  hasDay: boolean;
  next?: Task;
  nextClock?: string;
  minutesUntilNext: number;
  missed: Task[];
  missedClock?: string;
  remaining: number;
  minutesLeft: number;
  waiting: number;
  overdue: number;
  allDone: boolean;
  replan: () => Promise<string>;
}): { text: string; suggestions: Suggestion[] } {
  const hi = input.name ? `, ${input.name}` : "";
  const extras: Suggestion[] = [
    ...(input.waiting
      ? [{ label: `Fit in ${input.waiting} waiting`, icon: "history" as const, say: "Find time today for the tasks that are waiting." }]
      : []),
    ...(input.overdue
      ? [{ label: "Carry over unfinished", icon: "redo" as const, say: "Help me fit in the unfinished tasks from earlier days." }]
      : []),
  ];
  if (!input.isToday)
    return {
      text: input.hasDay
        ? `Here’s what’s lined up for this day. Want me to change anything?`
        : `Nothing on this day yet. Tell me what it should hold and I’ll lay it out.`,
      suggestions: [
        { label: "Plan this day", icon: "sparkle", say: "Help me plan this day." },
        { label: "Plan my week", icon: "calendar", say: "Let's plan my week." },
      ],
    };
  if (!input.hasDay) {
    const opener =
      input.hour < 12
        ? `Morning${hi}! What’s on your plate today?`
        : input.hour < 18
          ? `Hey${hi}. What do you still want to get done today?`
          : `Evening${hi}. Want to plan tomorrow so it’s ready when you wake up?`;
    return {
      text: `${opener} Just talk, I’ll turn it into a plan.`,
      suggestions: [
        input.hour < 18
          ? { label: "Plan my day", icon: "sparkle", say: "Help me plan my day." }
          : { label: "Plan tomorrow", icon: "sun", say: "Help me plan tomorrow." },
        { label: "Plan my week", icon: "calendar", say: "Let's plan my week." },
        { label: "Set up a project", icon: "newFolder", project: true },
        ...extras,
      ],
    };
  }
  if (input.missed.length) {
    const t = input.missed[0];
    return {
      text: `“${t.title}” was at ${input.missedClock}. Did it happen? I can mark it done or find it a new time.`,
      suggestions: [
        { label: "I did it", icon: "check", say: `I finished ${t.title}.` },
        { label: "Move it later", icon: "clock", say: `I didn't do ${t.title}. Move it to later.` },
        { label: "Replan from now", icon: "sync", run: input.replan },
        ...extras,
      ],
    };
  }
  if (input.allDone)
    return {
      text: `That’s everything for today${hi}. Nicely done. Want a head start on tomorrow?`,
      suggestions: [
        { label: "Plan tomorrow", icon: "sun", say: "Help me plan tomorrow." },
        { label: "Plan my week", icon: "calendar", say: "Let's plan my week." },
        { label: "Add something", icon: "add", say: "I want to add something." },
      ],
    };
  if (input.next) {
    const t = input.next;
    const now = input.minutesUntilNext <= 0;
    const lead = now
      ? `Time for “${t.title}”.`
      : `Next up: “${t.title}” at ${input.nextClock}, in ${span(input.minutesUntilNext)}.`;
    const tail = t.note
      ? t.note
      : `${input.remaining} ${input.remaining === 1 ? "thing" : "things"} left today, about ${span(input.minutesLeft)}.`;
    return {
      text: `${lead} ${tail}`,
      suggestions: [
        now
          ? { label: "I need more time", icon: "timer", say: `I need more time for ${t.title}.` }
          : { label: "What should I do now?", icon: "bolt", say: "What should I do right now?" },
        { label: "I'm running late", icon: "clock", say: "I'm running late. Adjust the rest of my day." },
        { label: "Replan from now", icon: "sync", run: input.replan },
        ...extras,
        { label: "Plan my week", icon: "calendar", say: "Let's plan my week." },
      ],
    };
  }
  return {
    text: input.waiting
      ? `You’ve got ${input.waiting} ${input.waiting === 1 ? "task" : "tasks"} waiting for a time. Shall I fit them in?`
      : `Your plan is set. Tell me if anything changes.`,
    suggestions: [
      { label: "Replan from now", icon: "sync", run: input.replan },
      ...extras,
      { label: "Add something", icon: "add", say: "I want to add something." },
    ],
  };
}

/** Tempo speaking on a screen: a short message and things to tap. */
export function TempoSays({
  text,
  suggestions,
}: {
  text: string;
  suggestions: Suggestion[];
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState("");
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
        <Tap accessibilityRole="button" accessibilityLabel="Talk to Tempo" onPress={() => talk()} scale={0.9}>
          <Orb size={38} />
        </Tap>
        <View
          style={{
            flex: 1,
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderBottomLeftRadius: 6,
            paddingHorizontal: 15,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: theme.line,
            ...shadow.soft,
          }}
        >
          <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 15, lineHeight: 22, color: theme.ink }}>
            {reply || text}
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingLeft: 48, paddingRight: 4 }}
      >
        {suggestions.map((s) => (
          <SuggestionChip
            key={s.label}
            suggestion={s}
            busy={busy === s.label}
            onPress={async () => {
              if (s.run) {
                setBusy(s.label);
                try {
                  setReply(await s.run());
                } catch (e) {
                  setReply(e instanceof Error ? e.message : "That didn’t work. Try again.");
                } finally {
                  setBusy("");
                }
              } else talk(s.say, s.project ? "project" : undefined);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function SuggestionChip({
  suggestion,
  onPress,
  busy = false,
  dark = false,
}: {
  suggestion: Pick<Suggestion, "label" | "icon">;
  onPress: () => void;
  busy?: boolean;
  dark?: boolean;
}) {
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={suggestion.label}
      disabled={busy}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 14,
        height: 38,
        borderRadius: 19,
        backgroundColor: dark ? "rgba(255,255,255,0.08)" : theme.surface,
        borderWidth: 1,
        borderColor: dark ? theme.darkLine : theme.lineStrong,
        opacity: busy ? 0.5 : 1,
      }}
    >
      <Icon name={suggestion.icon} size={16} color={dark ? theme.mint : theme.accent} />
      <Text
        style={{
          fontFamily: theme.fonts.semibold,
          fontSize: 13.5,
          color: dark ? theme.surface : theme.ink,
        }}
      >
        {busy ? "Working…" : suggestion.label}
      </Text>
    </Tap>
  );
}

/** Tempo's face. */
export function TempoAvatar({ size = 32, active = false }: { size?: number; active?: boolean }) {
  return <Orb size={size} active={active} />;
}

/** Three bouncing dots while Tempo is thinking. */
export function TypingDots() {
  const value = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: native,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return (
    <View style={{ flexDirection: "row", gap: 5, paddingVertical: 4 }}>
      {[0, 1, 2].map((i) => {
        const start = i * 0.2;
        return (
          <Animated.View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.muted,
              opacity: value.interpolate({
                inputRange: [0, start, start + 0.2, start + 0.4, 1],
                outputRange: [0.3, 0.3, 1, 0.3, 0.3],
              }),
              transform: [
                {
                  translateY: value.interpolate({
                    inputRange: [0, start, start + 0.2, start + 0.4, 1],
                    outputRange: [0, 0, -4, 0, 0],
                  }),
                },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
