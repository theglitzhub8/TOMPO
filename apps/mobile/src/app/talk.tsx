import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import {
  Screen,
  Card,
  Body,
  Button,
  Eyebrow,
  Field,
  Notice,
  theme,
} from "../components/ui";
import { VoiceInput } from "../components/voice-input";
import { useTempo } from "../data/store";
import * as session from "../lib/session";
import {
  askTempo,
  applyActions,
  describe,
  type AssistantAction,
  type CheckinKind,
  type Turn,
} from "../lib/assistant";

const muteKey = "tempo-assistant-muted";

export default function Talk() {
  const params = useLocalSearchParams<{ task?: string; checkin?: string }>();
  const tasks = useTempo((s) => s.tasks);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [proposal, setProposal] = useState<AssistantAction[]>([]);
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
      try {
        const answer = await askTempo(next, checkin);
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
    [],
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

  // A reminder tap opens a check-in: Tempo asks first.
  useEffect(() => {
    const kind = params.checkin as CheckinKind | undefined;
    const key = `${params.task}:${kind}`;
    if (!params.task || !kind || opened.current === key) return;
    if (!["start", "end", "followup"].includes(kind)) return;
    if (!useTempo.getState().tasks.some((t) => t.id === params.task)) return;
    const taskId = params.task;
    const timer = setTimeout(() => {
      opened.current = key;
      turnsRef.current = [];
      void ask([], { taskId, kind });
    }, 0);
    return () => clearTimeout(timer);
  }, [params.task, params.checkin, ask]);

  const onListening = (on: boolean) => {
    setListening(on);
    if (on) void Speech.stop();
    // When the person stops talking, send what they said.
    if (wasListening.current && !on) send(draftRef.current);
    wasListening.current = on;
  };

  return (
    <Screen title="Talk to Tempo." eyebrow="ASSISTANT">
      <View style={{ gap: 12 }}>
        {!turns.length && !busy && (
          <Card>
            <Body>
              Tap the microphone and talk naturally: “Move gym to 7, add call Mum
              for tomorrow, and I finished the report.” Tempo suggests the
              changes and nothing happens until you confirm.
            </Body>
          </Card>
        )}
        {turns.map((turn, i) => (
          <View
            key={i}
            style={{
              alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              backgroundColor: turn.role === "user" ? theme.night : theme.surface,
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderWidth: turn.role === "user" ? 0 : 1,
              borderColor: theme.line,
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.regular,
                fontSize: 16,
                lineHeight: 22,
                color: turn.role === "user" ? theme.surface : theme.ink,
              }}
            >
              {turn.content}
            </Text>
          </View>
        ))}
        {busy && <Body>Tempo is thinking…</Body>}
        {!!proposal.length && (
          <Card style={{ gap: 12 }}>
            <Eyebrow>SUGGESTED CHANGES</Eyebrow>
            {proposal.map((action, i) => (
              <Body key={i}>• {describe(action, tasks)}</Body>
            ))}
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <Button
                title={applying ? "Applying…" : "Apply changes"}
                icon="check"
                compact
                disabled={applying}
                style={{ flex: 1, minWidth: 140 }}
                onPress={async () => {
                  setApplying(true);
                  setError("");
                  try {
                    const done = await applyActions(proposal);
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
              />
              <Button
                title="Not now"
                variant="secondary"
                compact
                disabled={applying}
                style={{ flex: 1, minWidth: 110 }}
                onPress={() => setProposal([])}
              />
            </View>
          </Card>
        )}
        {!!error && <Notice tone="danger">{error}</Notice>}
        <VoiceInput
          value={draft}
          onChange={(v) => {
            draftRef.current = v;
            setDraft(v);
          }}
          disabled={busy || applying}
          onListening={onListening}
        />
        <Field
          label="Or type to Tempo"
          value={draft}
          onChangeText={(v) => {
            draftRef.current = v;
            setDraft(v);
          }}
          multiline
          placeholder="What do you need?"
        />
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Button
            title="Send"
            icon="send"
            compact
            disabled={busy || listening || !draft.trim()}
            style={{ flex: 1, minWidth: 120 }}
            onPress={() => send(draft)}
          />
          <Button
            title={muted ? "Voice replies off" : "Voice replies on"}
            variant="ghost"
            compact
            style={{ flex: 1, minWidth: 150 }}
            onPress={() => {
              const next = !muted;
              mutedRef.current = next;
              setMuted(next);
              if (next) void Speech.stop();
              void session.setItemAsync(muteKey, next ? "on" : "off");
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
