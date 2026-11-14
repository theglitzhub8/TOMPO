import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { Icon, Reveal, Tap, theme, type IconName } from "../components/ui";
import { SuggestionChip, TempoAvatar, TypingDots } from "../components/helper";
import { useVoice } from "../components/voice-input";
import { shadow, gradient, gradients } from "../design/tokens";
import { useTempo, type Task } from "../data/store";
import * as session from "../lib/session";
import {
  askTempo,
  applyActions,
  describe,
  type AssistantAction,
  type CheckinKind,
  type Turn,
} from "../lib/assistant";
import { localParts } from "../../../../packages/core/src/scheduling";

const muteKey = "tempo-assistant-muted";

const starters: { label: string; icon: IconName; say: string }[] = [
  { label: "Plan my day", icon: "sparkle", say: "Help me plan my day." },
  { label: "Plan my week", icon: "calendar", say: "Let's plan my week." },
  { label: "What should I do now?", icon: "bolt", say: "What should I do right now?" },
  { label: "I'm running late", icon: "clock", say: "I'm running late. Adjust the rest of my day." },
  { label: "Clean up my task names", icon: "edit", say: "Polish the wording of my tasks." },
];
const projectStarters: typeof starters = [
  { label: "Launch something", icon: "bolt", say: "I want to launch something. Help me set it up as a project." },
  { label: "Study for an exam", icon: "list", say: "I have an exam coming up. Help me set up a study project." },
  { label: "Fix up my home", icon: "home", say: "I want to sort out my home. Help me set it up as a project." },
];

export default function Talk() {
  const params = useLocalSearchParams<{
    task?: string;
    checkin?: string;
    focus?: string;
    say?: string;
  }>();
  // Opened from Projects: Tempo sets up a project from what the person describes.
  const focus = params.focus === "project" ? "project" : undefined;
  const tasks = useTempo((s) => s.tasks);
  const timezone = useTempo((s) => s.preferences.timezone);
  const firstName = useTempo((s) => s.user?.name.trim().split(/\s+/)[0] ?? "");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [proposal, setProposal] = useState<AssistantAction[]>([]);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [listening, setListening] = useState(false);
  const turnsRef = useRef<Turn[]>([]);
  const draftRef = useRef("");
  const mutedRef = useRef(false);
  const wasListening = useRef(false);
  const opened = useRef("");
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    void session.getItemAsync(muteKey).then((v) => {
      mutedRef.current = v === "on";
      setMuted(v === "on");
    });
    return () => void Speech.stop();
  }, []);

  const say = (text: string) => {
    if (mutedRef.current) return;
    void Speech.stop();
    Speech.speak(text, { rate: 1.0 });
  };

  const ask = useCallback(
    async (next: Turn[], checkin?: { taskId: string; kind: CheckinKind }) => {
      setBusy(true);
      setError("");
      setProposal([]);
      setSkipped(new Set());
      turnsRef.current = next;
      setTurns(next);
      try {
        const answer = await askTempo(next, checkin, focus);
        const all = [...next, { role: "assistant" as const, content: answer.reply }];
        turnsRef.current = all;
        setTurns(all);
        setProposal(answer.actions);
        say(answer.reply);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Tempo couldn’t answer. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [focus],
  );

  const send = useCallback(
    (words: string) => {
      const content = words.trim();
      if (!content || busy) return;
      draftRef.current = "";
      setDraft("");
      // Keep the last few exchanges so requests stay small.
      void ask([...turnsRef.current, { role: "user" as const, content }].slice(-16));
    },
    [ask, busy],
  );

  const setText = (v: string) => {
    draftRef.current = v;
    setDraft(v);
  };
  const voice = useVoice({
    value: draft,
    onChange: setText,
    onListening: (on) => {
      setListening(on);
      if (on) void Speech.stop();
      // When the person stops talking, send what they said.
      if (wasListening.current && !on) send(draftRef.current);
      wasListening.current = on;
    },
  });

  // A reminder tap opens a check-in, and a suggestion opens with its words: Tempo answers first.
  useEffect(() => {
    const kind = params.checkin as CheckinKind | undefined;
    const key = `${params.task}:${kind}:${params.say}`;
    if (opened.current === key) return;
    let start: (() => void) | undefined;
    if (params.task && kind && ["start", "end", "followup"].includes(kind)) {
      if (!useTempo.getState().tasks.some((t) => t.id === params.task)) return;
      const taskId = params.task;
      start = () => {
        turnsRef.current = [];
        void ask([], { taskId, kind });
      };
    } else if (params.say?.trim()) {
      const words = params.say.trim();
      start = () => void ask([{ role: "user", content: words }]);
    }
    if (!start) return;
    const timer = setTimeout(() => {
      opened.current = key;
      start();
    }, 0);
    return () => clearTimeout(timer);
  }, [params.task, params.checkin, params.say, ask]);

  const today = localParts(new Date(), timezone).date;
  const chosen = proposal.filter((_, i) => !skipped.has(i));
  const empty = !turns.length && !busy;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[{ flex: 1 }, gradient(gradients.paper)]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: theme.line,
            }}
          >
            <RoundButton
              icon="back"
              label="Back"
              onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
            />
            <TempoAvatar size={38} active={listening || busy} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: theme.fonts.heavy, fontSize: 17, color: theme.ink, letterSpacing: -0.4 }}>
                {focus ? "Project setup" : "Tempo"}
              </Text>
              <Text style={{ fontFamily: theme.fonts.medium, fontSize: 12.5, color: listening ? theme.accent : theme.muted }}>
                {listening ? "Listening…" : busy ? "Thinking…" : applying ? "Updating your plan…" : "Your planning helper"}
              </Text>
            </View>
            <RoundButton
              icon={muted ? "bellOff" : "wave"}
              label={muted ? "Turn voice replies on" : "Turn voice replies off"}
              onPress={() => {
                const next = !muted;
                mutedRef.current = next;
                setMuted(next);
                if (next) void Speech.stop();
                void session.setItemAsync(muteKey, next ? "on" : "off");
              }}
            />
          </View>

          {/* Conversation */}
          <ScrollView
            ref={scroll}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{
              flexGrow: 1,
              gap: 12,
              padding: 18,
              paddingBottom: 24,
              justifyContent: empty ? "center" : "flex-start",
            }}
            showsVerticalScrollIndicator={false}
          >
            {empty && (
              <Reveal style={{ alignItems: "center", gap: 14 }}>
                <View style={{ borderRadius: 40, ...shadow.glow }}>
                  <TempoAvatar size={72} />
                </View>
                <Text
                  style={{
                    fontFamily: theme.fonts.display,
                    fontSize: 34,
                    lineHeight: 38,
                    color: theme.ink,
                    textAlign: "center",
                  }}
                >
                  {focus
                    ? "Tell me about your project."
                    : `Hi${firstName ? ` ${firstName}` : ""}. How can I help?`}
                </Text>
                <Text
                  style={{
                    fontFamily: theme.fonts.regular,
                    fontSize: 15,
                    lineHeight: 22,
                    color: theme.muted,
                    textAlign: "center",
                    maxWidth: 320,
                  }}
                >
                  {focus
                    ? "What it is, what needs doing and when it’s due. I’ll create it and spread the work over the coming days."
                    : "Talk like you would to a friend: your day, your week, what changed. I suggest the changes, you approve them."}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 6 }}>
                  {(focus ? projectStarters : starters).map((s) => (
                    <SuggestionChip key={s.label} suggestion={s} onPress={() => send(s.say)} />
                  ))}
                </View>
              </Reveal>
            )}
            {turns.map((turn, i) =>
              turn.role === "user" ? (
                <UserBubble key={i} text={turn.content} />
              ) : (
                <TempoBubble key={i}>
                  <Text style={bubbleText}>{turn.content}</Text>
                </TempoBubble>
              ),
            )}
            {listening && !!draft.trim() && <UserBubble text={draft} live />}
            {busy && (
              <TempoBubble>
                <TypingDots />
              </TempoBubble>
            )}
            {!!proposal.length && (
              <Reveal
                style={{
                  marginLeft: 38,
                  borderRadius: 24,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.line,
                  overflow: "hidden",
                  ...shadow.lifted,
                }}
              >
                <View style={{ padding: 16, paddingBottom: 6, gap: 2 }}>
                  <Text style={{ fontFamily: theme.fonts.bold, fontSize: 11, letterSpacing: 1.2, color: theme.accentDeep }}>
                    SUGGESTED CHANGES
                  </Text>
                  <Text style={{ fontFamily: theme.fonts.medium, fontSize: 12.5, color: theme.muted }}>
                    Tap any you don’t want. Nothing changes until you apply.
                  </Text>
                </View>
                {proposal.map((action, i) => (
                  <ChangeRow
                    key={i}
                    action={action}
                    tasks={tasks}
                    today={today}
                    on={!skipped.has(i)}
                    first={i === 0}
                    toggle={() =>
                      setSkipped((set) => {
                        const next = new Set(set);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                  />
                ))}
                <View style={{ flexDirection: "row", gap: 10, padding: 14 }}>
                  <Tap
                    accessibilityRole="button"
                    disabled={applying}
                    onPress={() => setProposal([])}
                    style={[pill, { backgroundColor: theme.surfaceMuted, flex: 1 }]}
                  >
                    <Text style={[pillText, { color: theme.inkSoft }]}>Not now</Text>
                  </Tap>
                  <Tap
                    accessibilityRole="button"
                    disabled={applying || !chosen.length}
                    onPress={async () => {
                      setApplying(true);
                      setError("");
                      try {
                        const done = await applyActions(chosen);
                        const all = [...turnsRef.current, { role: "assistant" as const, content: done }];
                        turnsRef.current = all;
                        setTurns(all);
                        setProposal([]);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Could not apply these changes.");
                      } finally {
                        setApplying(false);
                      }
                    }}
                    style={[
                      pill,
                      { flex: 2, backgroundColor: theme.accent, opacity: applying || !chosen.length ? 0.5 : 1 },
                      gradient(gradients.coral),
                    ]}
                  >
                    <Icon name="check" size={18} color={theme.surface} />
                    <Text style={[pillText, { color: theme.surface }]}>
                      {applying
                        ? "Applying…"
                        : `Apply ${chosen.length} ${chosen.length === 1 ? "change" : "changes"}`}
                    </Text>
                  </Tap>
                </View>
              </Reveal>
            )}
            {!!error && (
              <TempoBubble>
                <Text style={[bubbleText, { color: theme.danger }]}>{error}</Text>
              </TempoBubble>
            )}
            {!!voice.error && (
              <TempoBubble>
                <Text style={[bubbleText, { color: theme.danger }]}>{voice.error}</Text>
              </TempoBubble>
            )}
          </ScrollView>

          {/* Composer */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 10,
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 12,
            }}
          >
            <View
              style={{
                flex: 1,
                minHeight: 52,
                justifyContent: "center",
                borderRadius: 26,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: listening ? theme.accent : theme.lineStrong,
                paddingHorizontal: 18,
                paddingVertical: 8,
                ...shadow.soft,
              }}
            >
              <TextInput
                accessibilityLabel="Message Tempo"
                value={draft}
                onChangeText={setText}
                editable={!listening}
                multiline
                placeholder={listening ? "Listening… tap stop when you’re done" : "Message Tempo"}
                placeholderTextColor={listening ? theme.accent : theme.faint}
                style={{
                  maxHeight: 120,
                  fontFamily: theme.fonts.medium,
                  fontSize: 16,
                  lineHeight: 22,
                  color: theme.ink,
                  ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
                }}
              />
            </View>
            {draft.trim() && !listening ? (
              <Tap
                accessibilityRole="button"
                accessibilityLabel="Send"
                disabled={busy}
                onPress={() => send(draft)}
                scale={0.9}
                style={[
                  roundAction,
                  { backgroundColor: theme.ink, opacity: busy ? 0.4 : 1 },
                  gradient(gradients.night),
                ]}
              >
                <Icon name="send" size={22} color={theme.surface} />
              </Tap>
            ) : (
              <Tap
                accessibilityRole="button"
                accessibilityLabel={listening ? "Stop and send" : "Talk to Tempo"}
                disabled={busy || applying || voice.starting}
                onPress={voice.toggle}
                scale={0.9}
                style={[
                  roundAction,
                  {
                    backgroundColor: listening ? theme.ink : theme.accent,
                    opacity: busy || applying ? 0.4 : 1,
                    ...(listening ? shadow.lifted : shadow.glow),
                  },
                  gradient(listening ? gradients.night : gradients.coral),
                ]}
              >
                <Icon name={listening ? "stop" : "mic"} size={24} color={theme.surface} />
              </Tap>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const dayLabel = (day: string | null | undefined, today: string) => {
  if (!day || day === today) return "Today";
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  if (day === tomorrow) return "Tomorrow";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
};

const icons: Record<AssistantAction["type"], IconName> = {
  add: "add",
  update: "edit",
  complete: "checkCircle",
  reopen: "redo",
  delete: "delete",
  replan: "sync",
  project: "newFolder",
};

function ChangeRow({
  action,
  tasks,
  today,
  on,
  first,
  toggle,
}: {
  action: AssistantAction;
  tasks: Task[];
  today: string;
  on: boolean;
  first: boolean;
  toggle: () => void;
}) {
  const add = action.type === "add" ? action : null;
  const tone = action.type === "delete" ? theme.danger : action.type === "complete" ? theme.mintDeep : theme.accentDeep;
  return (
    <Tap
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={toggle}
      scale={0.99}
      style={{
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.line,
        opacity: on ? 1 : 0.45,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: action.type === "delete" ? theme.dangerSoft : action.type === "complete" ? theme.mintSoft : theme.accentSoft,
        }}
      >
        <Icon name={icons[action.type]} size={18} color={tone} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontFamily: theme.fonts.semibold,
            fontSize: 15,
            lineHeight: 21,
            color: theme.ink,
            textDecorationLine: on ? "none" : "line-through",
          }}
        >
          {add ? add.title : describe(action, tasks)}
        </Text>
        {add && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Meta icon="calendar" text={dayLabel(add.day, today)} />
            <Meta icon={add.clock ? "clock" : "bolt"} text={add.clock ?? "Flexible"} />
            <Meta icon="timer" text={`${add.duration} min`} />
            {!!add.project && <Meta icon="folder" text={add.project} />}
          </View>
        )}
        {!!add?.note && (
          <Text style={{ fontFamily: theme.fonts.regular, fontSize: 13.5, lineHeight: 19, color: theme.muted }}>
            {add.note}
          </Text>
        )}
      </View>
      <Icon name={on ? "checkCircle" : "circle"} size={22} color={on ? theme.accent : theme.faint} />
    </Tap>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name={icon} size={13} color={theme.muted} />
      <Text style={{ fontFamily: theme.fonts.medium, fontSize: 12.5, color: theme.inkSoft }}>{text}</Text>
    </View>
  );
}

function TempoBubble({ children }: { children: React.ReactNode }) {
  return (
    <Reveal style={{ flexDirection: "row", gap: 8, alignItems: "flex-end", maxWidth: "92%" }}>
      <TempoAvatar size={30} />
      <View
        style={{
          flexShrink: 1,
          backgroundColor: theme.surface,
          borderRadius: 22,
          borderBottomLeftRadius: 6,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: theme.line,
          ...shadow.soft,
        }}
      >
        {children}
      </View>
    </Reveal>
  );
}

function UserBubble({ text, live = false }: { text: string; live?: boolean }) {
  return (
    <Reveal style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
      <View
        style={[
          {
            backgroundColor: theme.night,
            borderRadius: 22,
            borderBottomRightRadius: 6,
            paddingHorizontal: 16,
            paddingVertical: 12,
            opacity: live ? 0.6 : 1,
          },
          gradient(gradients.night),
        ]}
      >
        <Text style={[bubbleText, { color: theme.surface }]}>
          {text}
          {live ? " …" : ""}
        </Text>
      </View>
    </Reveal>
  );
}

function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.line,
      }}
    >
      <Icon name={icon} size={19} color={theme.inkSoft} />
    </Tap>
  );
}

const bubbleText = {
  fontFamily: theme.fonts.regular,
  fontSize: 16,
  lineHeight: 23,
  color: theme.ink,
} as const;
const pill = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 48,
  borderRadius: 24,
} as const;
const pillText = { fontFamily: theme.fonts.bold, fontSize: 14.5 } as const;
const roundAction = {
  width: 52,
  height: 52,
  borderRadius: 26,
  alignItems: "center",
  justifyContent: "center",
} as const;
