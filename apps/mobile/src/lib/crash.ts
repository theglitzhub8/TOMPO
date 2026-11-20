import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiBase } from "./api";

let screen = "";
/** The route the person was on, sent with any crash. */
export const setCrashScreen = (path: string) => {
  screen = path;
};

const version = () =>
  [Constants.expoConfig?.version, Constants.expoConfig?.ios?.buildNumber].filter(Boolean).join(" (") +
  (Constants.expoConfig?.ios?.buildNumber ? ")" : "");

/** Sends an app error to Tempo's server log. Never throws. */
export async function reportCrash(error: unknown, fatal = false) {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    await fetch(`${await apiBase()}/v1/crash`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: e.message || e.name,
        stack: e.stack ?? "",
        screen,
        version: version(),
        platform: Platform.OS,
        fatal,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Reporting is best effort.
  }
}

type Handler = (error: unknown, isFatal?: boolean) => void;
const errorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void } }).ErrorUtils;
let installed = false;
/** Reports uncaught errors, then lets React Native handle them as before. */
export function installCrashReporting() {
  if (installed || !errorUtils || __DEV__) return;
  installed = true;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    void reportCrash(error, !!isFatal);
    previous(error, isFatal);
  });
}
