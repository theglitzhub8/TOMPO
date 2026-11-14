import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import {
  ExpoSpeechRecognitionModule as speech,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { VoiceOrb } from "./voice-orb";
export function useVoice({
  value,
  onChange,
  onListening,
}: {
  value: string;
  onChange: (v: string) => void;
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
  const toggle = async () => {
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
  };
  return { listening, starting: false, error, toggle };
}

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
  const { listening, error, toggle } = useVoice({ value, onChange, onListening });
  return (
    <VoiceOrb
      listening={listening}
      disabled={disabled}
      error={error}
      hint={
        listening
          ? "Speak naturally. Your words appear below as you talk."
          : "Speak in one take, or type below. Your browser’s speech service may process audio online."
      }
      onPress={toggle}
    />
  );
}
