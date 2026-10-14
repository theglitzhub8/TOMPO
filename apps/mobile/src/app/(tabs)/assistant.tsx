import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Screen,
  Card,
  Body,
  Button,
  Heading,
  theme,
} from "../../components/ui";
import { ModeOptions } from "../../components/preferences";
import { useTempo } from "../../data/store";
export default function Assistant() {
  const [consent, setConsent] = useState(false);
  const [modeError, setModeError] = useState("");
  const [savingMode, setSavingMode] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "active" | "ended"
  >("idle");
  const [history, setHistory] = useState<string[]>([]);
  const { preferences, save } = useTempo();
  useEffect(() => {
    if (status !== "connecting") return;
    const timer = setTimeout(() => setStatus("active"), 1500);
    return () => clearTimeout(timer);
  }, [status]);
  const end = () => {
    if (status === "active" || status === "connecting")
      setHistory([new Date().toISOString(), ...history]);
    setStatus("ended");
  };
  return (
    <Screen
      eyebrow="VOICE ACCOUNTABILITY"
      title="Your AI assistant"
      subtitle="A firm voice that keeps you focused."
    >
      <Card
        dark
        style={{
          minHeight: 395,
          alignItems: "center",
          paddingVertical: 32,
          gap: 25,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.bold,
            fontSize: 12,
            color: theme.darkMuted,
          }}
        >
          SIMULATION · {status.toUpperCase()}
        </Text>
        <View
          style={{
            width: 116,
            height: 116,
            borderRadius: 58,
            backgroundColor: theme.callAvatar,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bold,
              fontSize: 50,
              color: theme.mint,
            }}
          >
            ✦
          </Text>
        </View>
        <Text
          style={{
            fontFamily: theme.fonts.bold,
            fontSize: 23,
            color: theme.surface,
          }}
        >
          Tempo Assistant
        </Text>
        <Body light>
          {status === "active"
            ? "Which task will you focus on next?"
            : "It’s time for your next check-in."}
        </Body>
        <View style={{ flexDirection: "row", gap: 46 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End simulation"
            onPress={end}
            style={{
              backgroundColor: theme.danger,
              width: 66,
              height: 55,
              borderRadius: 30,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 28, color: theme.surface }}>✕</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start simulated call"
            accessibilityState={{
              disabled:
                !consent || status === "active" || status === "connecting",
            }}
            disabled={
              !consent || status === "active" || status === "connecting"
            }
            onPress={() => setStatus("connecting")}
            style={{
              backgroundColor: theme.callAccept,
              width: 66,
              height: 55,
              borderRadius: 30,
              opacity: consent ? 1 : 0.5,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 25 }}>☎</Text>
          </Pressable>
        </View>
      </Card>
      <Card style={{ minHeight: 103, padding: 18, gap: 8 }}>
        <Heading small>Accountability mode</Heading>
        <ModeOptions
          value={preferences.mode}
          disabled={savingMode}
          onChange={async (mode) => {
            setSavingMode(true);
            setModeError("");
            try {
              await save("preferences", { ...preferences, mode });
            } catch (e) {
              setModeError(String(e));
            } finally {
              setSavingMode(false);
            }
          }}
        />
        {modeError && <Body>{modeError}</Body>}
      </Card>
      <Button
        title={
          consent ? "Opt out of simulation" : "Consent to simulated session"
        }
        onPress={() => {
          setConsent(!consent);
          setStatus("idle");
        }}
      />
      <Body>
        Clearly simulated: no microphone, audio, AI response, incoming telephone
        call, or real call is connected. History below lasts until this screen
        closes.
      </Body>
      {history.map((time, i) => (
        <Body key={i}>Simulated session ended · {time}</Body>
      ))}
    </Screen>
  );
}
