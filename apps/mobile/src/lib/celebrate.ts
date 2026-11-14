import { requireOptionalNativeModule } from "expo";
import * as Haptics from "expo-haptics";
import * as session from "./session";

// Audio is native: older installed builds of the app don't have it, so load it only when present.
type Audio = typeof import("expo-audio");
const audio: Audio | null = requireOptionalNativeModule("ExpoAudio")
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only when the native module exists
    require("expo-audio")
  : null;

const soundKey = "tempo-sounds";
const sounds = {
  task: require("../../assets/sounds/task-done.wav"),
  day: require("../../assets/sounds/day-done.wav"),
};
const cheers = [
  "One more done.",
  "Momentum!",
  "Look at you go.",
  "Done and dusted.",
  "That’s how it’s done.",
  "Keep that pace.",
  "Another one down.",
];

export type Burst = { id: number; kind: "task" | "day"; cheer: string; points: number };
const listeners = new Set<(burst: Burst) => void>();
export const onBurst = (listener: (burst: Burst) => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

let soundOn: boolean | undefined;
export async function soundsEnabled() {
  soundOn ??= (await session.getItemAsync(soundKey)) !== "off";
  return soundOn;
}
export async function setSoundsEnabled(on: boolean) {
  soundOn = on;
  await session.setItemAsync(soundKey, on ? "on" : "off");
}

async function play(kind: Burst["kind"]) {
  if (!audio || !(await soundsEnabled())) return;
  // Respect the silent switch and mix with whatever else is playing.
  await audio.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" });
  const player = audio.createAudioPlayer(sounds[kind]);
  player.play();
  setTimeout(() => player.remove(), 4000);
}

let next = 0;
/** A small treat for finishing: buzz, chime, confetti and a cheer. */
export function celebrate(kind: Burst["kind"]) {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  void play(kind).catch(() => undefined);
  const burst: Burst = {
    id: next++,
    kind,
    cheer: kind === "day" ? "Day done!" : cheers[Math.floor(Math.random() * cheers.length)],
    points: kind === "day" ? 50 : 10,
  };
  listeners.forEach((l) => l(burst));
}
