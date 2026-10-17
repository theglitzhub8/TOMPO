import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useIsFocused } from "expo-router";
import {
  ExpoSpeechRecognitionModule as speech,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { Body, Button } from "./ui";
export function VoiceInput({
  value,
  onChange,
  disabled,
  onListening,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onListening: (v: boolean) => void;
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const prefix = useRef("");
  const final = useRef("");
  const focused = useIsFocused();
  useSpeechRecognitionEvent("start", () => {
    if (!focused) return;
    setListening(true);
    onListening(true);
  });
  useSpeechRecognitionEvent("end", () => {
    if (!focused) return;
    setListening(false);
    onListening(false);
  });
  useSpeechRecognitionEvent("result", (e) => {
    if (!focused) return;
    const part = e.results[0]?.transcript || "";
    onChange([prefix.current, final.current, part].filter(Boolean).join(" "));
    if (e.isFinal)
      final.current = [final.current, part].filter(Boolean).join(" ");
  });
  useSpeechRecognitionEvent("error", (e) => {
    if (!focused) return;
    setError(`Voice stopped: ${e.message || e.error}. You can type below.`);
    setListening(false);
    onListening(false);
  });
  useEffect(
    () => () => {
      speech.abort();
    },
    [],
  );
  useEffect(() => {
    if (!focused) speech.abort();
  }, [focused]);
  return (
    <View style={{ gap: 10 }}>
      <Button
        disabled={disabled}
        title={listening ? "■ Finish speaking" : "● Tell Tempo your day"}
        onPress={async () => {
          if (listening) {
            speech.stop();
            return;
          }
          setError("");
          try {
            if (!speech.isRecognitionAvailable())
              throw new Error(
                "Voice is unavailable in this browser. Use Chrome or type below.",
              );
            const p = await speech.requestPermissionsAsync();
            if (!p.granted)
              throw new Error("Allow microphone access, or type below.");
            prefix.current = value.trim();
            final.current = "";
            speech.start({
              lang: "en-US",
              interimResults: true,
              continuous: true,
            });
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not start voice.");
            onListening(false);
          }
        }}
      />
      <Body small>
        {listening
          ? "Listening… tap Finish speaking when you’re done."
          : "Speak in one take, or type below. Your browser’s speech service may process audio online."}
      </Body>
      {!!error && <Body>{error}</Body>}
    </View>
  );
}
