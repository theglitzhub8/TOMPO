import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import { requireOptionalNativeModule } from "expo";
import type { ExpoSpeechRecognitionModuleType } from "expo-speech-recognition/build/ExpoSpeechRecognitionModule.types";
import { VoiceOrb } from "./voice-orb";

const speech = requireOptionalNativeModule<ExpoSpeechRecognitionModuleType>(
  "ExpoSpeechRecognition",
);
/** Speech-to-text for one field: words are appended to `value` as the person talks. */
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
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const prefix = useRef("");
  const final = useRef("");
  const callbacks = useRef({ onChange, onListening });
  useEffect(() => {
    callbacks.current = { onChange, onListening };
  }, [onChange, onListening]);
  const focused = useIsFocused();
  useEffect(() => {
    if (!speech || !focused) return;
    const listeners = [
      speech.addListener("start", () => {
        setStarting(false);
        setListening(true);
        callbacks.current.onListening(true);
      }),
      speech.addListener("end", () => {
        setStarting(false);
        setListening(false);
        callbacks.current.onListening(false);
      }),
      speech.addListener("result", (event) => {
        const part = event.results[0]?.transcript || "";
        const transcript = [prefix.current, final.current, part]
          .filter(Boolean)
          .join(" ");
        callbacks.current.onChange(transcript);
        if (event.isFinal)
          final.current = [final.current, part].filter(Boolean).join(" ");
      }),
      speech.addListener("error", (event) => {
        if (event.error !== "aborted")
          setError(
            event.error === "not-allowed"
              ? "Microphone or speech access was denied. Enable it in your phone settings, or type below."
              : `Voice stopped: ${event.message || event.error}. Your words are still below.`,
          );
        setStarting(false);
        setListening(false);
        callbacks.current.onListening(false);
      }),
    ];
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active") speech.abort();
    });
    return () => {
      speech.abort();
      listeners.forEach((l) => l.remove());
      app.remove();
      callbacks.current.onListening(false);
    };
  }, [focused]);
  useEffect(() => {
    if (!focused) speech?.abort();
  }, [focused]);
  const toggle = async () => {
    if (!speech) {
      setError(
        "Voice isn’t included in this version of the app (for example, Expo Go). Install the latest Tempo app, or use your keyboard’s microphone to dictate here.",
      );
      return;
    }
    if (listening) {
      speech.stop();
      return;
    }
    setError("");
    setStarting(true);
    callbacks.current.onListening(true);
    try {
      if (!speech.isRecognitionAvailable())
        throw new Error(
          "Speech recognition is unavailable on this device. Try keyboard dictation or type below.",
        );
      const permission = await speech.requestPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Allow microphone and speech recognition in Settings, or type below.",
        );
      prefix.current = value.trim();
      final.current = "";
      speech.start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        iosTaskHint: "dictation",
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not start voice. Try typing below.",
      );
      setStarting(false);
      callbacks.current.onListening(false);
    }
  };
  return { listening, starting, error, toggle };
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
  const { listening, starting, error, toggle } = useVoice({ value, onChange, onListening });
  return (
    <VoiceOrb
      listening={listening}
      starting={starting}
      disabled={disabled}
      error={error}
      hint={
        listening
          ? "Speak naturally. Your words appear below as you talk."
          : "Speak in one take, or type below. Speech recognition uses your device’s speech service and may need internet."
      }
      onPress={toggle}
    />
  );
}
