import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Chip, Icon, ListRow, Reveal, Tap, theme } from "./ui";
import { shadow, gradient, gradients } from "../design/tokens";
import { useTempo, type Preferences } from "../data/store";
import * as session from "../lib/session";
import {
  disableReminders,
  enableReminders,
  getReminderStatus,
  remindersSupported,
  sendTestReminder,
  type ReminderStatus,
} from "../lib/reminders";

const dismissKey = "tempo-reminder-prompt";

/** Live reminder status, refreshed when the app returns from system settings. */
export function useReminderStatus() {
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const refresh = useCallback(() => {
    getReminderStatus()
      .then(setStatus)
      .catch(() => setStatus("unsupported"));
  }, []);
  useEffect(() => {
    refresh();
    const app = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => app.remove();
  }, [refresh]);
  return [status, setStatus, refresh] as const;
}

/** Asks once, at a useful moment: there is something scheduled to remind about. */
export function ReminderPrompt({ upcoming }: { upcoming: number }) {
  const [status, setStatus] = useReminderStatus();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    session
      .getItemAsync(dismissKey)
      .then((v) => setDismissed(v === "dismissed"))
      .catch(() => setDismissed(false));
  }, []);
  if (!remindersSupported || !upcoming || dismissed !== false || status !== "undetermined")
    return null;
  return (
    <Reveal>
      <View
        style={[
          {
            padding: 18,
            gap: 14,
            borderRadius: 24,
            backgroundColor: theme.night,
            ...shadow.lifted,
          },
          gradient(gradients.nightGlow),
        ]}
      >
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <View
            style={[
              {
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.accent,
              },
              gradient(gradients.coral),
            ]}
          >
            <Icon name="bellRing" size={22} color={theme.surface} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontFamily: theme.fonts.bold, fontSize: 16, color: theme.surface }}>
              Get a nudge when it’s time
            </Text>
            <Text style={{ fontFamily: theme.fonts.regular, fontSize: 13.5, lineHeight: 19, color: theme.darkMuted }}>
              Tempo will remind you as each task starts, and tell you when a teammate adds you to one.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Tap
            accessibilityRole="button"
            onPress={() => {
              setDismissed(true);
              void session.setItemAsync(dismissKey, "dismissed");
            }}
            style={{ flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 14, color: theme.darkMuted }}>Not now</Text>
          </Tap>
          <Tap
            accessibilityRole="button"
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                setStatus(await enableReminders());
              } finally {
                setBusy(false);
              }
            }}
            style={{ flex: 1.4, height: 44, borderRadius: 22, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface }}
          >
            <Icon name="bell" size={18} color={theme.ink} />
            <Text style={{ fontFamily: theme.fonts.bold, fontSize: 14, color: theme.ink }}>
              {busy ? "Turning on…" : "Turn on reminders"}
            </Text>
          </Tap>
        </View>
      </View>
    </Reveal>
  );
}

const modes: { mode: Preferences["mode"]; title: string; detail: string }[] = [
  { mode: "Gentle", title: "Gentle", detail: "Once, when it starts" },
  { mode: "Firm", title: "Firm", detail: "Plus one nudge 10 min later" },
  { mode: "Strict", title: "Strict", detail: "Plus two nudges, 10 min apart" },
];

/** Settings rows: on/off, how persistent, quiet hours and a test. */
export function ReminderSettings() {
  const { preferences, save } = useTempo();
  const [status, setStatus] = useReminderStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  if (!remindersSupported)
    return (
      <ListRow
        icon="bell"
        title="Task reminders"
        detail="Reminders arrive on your phone. Open Tempo on your phone to turn them on."
        last
      />
    );
  const on = status === "on";
  const detail =
    status === "on"
      ? "On. You’ll get a reminder when each task starts and a check-in when it should be done."
      : status === "denied"
        ? "Notifications are blocked for Tempo. Allow them in your phone’s settings."
        : status === "off"
          ? "Off on this phone."
          : "Get a reminder on this phone when each task is due.";
  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      if (status === "denied") await Linking.openSettings();
      else if (on) {
        await disableReminders();
        setStatus("off");
      } else setStatus(await enableReminders());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change reminders.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ListRow
        icon={on ? "bellRing" : status === "denied" ? "bellOff" : "bell"}
        title="Task reminders"
        detail={detail}
        trailing={
          status === null ? undefined : (
            <Chip icon={on ? "check" : undefined} tone={on ? "mint" : status === "denied" ? "accent" : "neutral"}>
              {on ? "On" : status === "denied" ? "Blocked" : "Off"}
            </Chip>
          )
        }
      />
      <View style={{ paddingHorizontal: 18, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.line }}>
        <Button
          title={
            busy
              ? "One moment…"
              : status === "denied"
                ? "Open phone settings"
                : on
                  ? "Turn off reminders"
                  : "Turn on reminders"
          }
          icon={on ? "bellOff" : "bell"}
          variant={on ? "secondary" : "primary"}
          compact
          disabled={busy || status === null}
          onPress={toggle}
        />
        {on && (
          <Button
            title={sent ? "Sent · arriving in 5 seconds" : "Send a test reminder"}
            icon="send"
            variant="ghost"
            compact
            onPress={async () => {
              await sendTestReminder();
              setSent(true);
              setTimeout(() => setSent(false), 6000);
            }}
          />
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={{ fontFamily: theme.fonts.medium, fontSize: 13, color: theme.danger }}>
            {error}
          </Text>
        )}
      </View>
      <View style={{ paddingHorizontal: 18, paddingVertical: 14, gap: 10 }}>
        <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 14, color: theme.ink }}>
          If I haven’t started yet
        </Text>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {modes.map((m) => {
            const selected = preferences.mode === m.mode;
            return (
              <Tap
                key={m.mode}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${m.title}: ${m.detail}`}
                onPress={async () => {
                  try {
                    setError("");
                    await save("preferences", { ...preferences, mode: m.mode });
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save that.");
                  }
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: selected ? theme.ink : theme.line,
                  backgroundColor: selected ? theme.surface : theme.background,
                }}
              >
                <Icon name={selected ? "checkCircle" : "circle"} size={20} color={selected ? theme.ink : theme.faint} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: theme.fonts.bold, fontSize: 14, color: theme.ink }}>{m.title}</Text>
                  <Text style={{ fontFamily: theme.fonts.regular, fontSize: 12.5, color: theme.muted }}>{m.detail}</Text>
                </View>
              </Tap>
            );
          })}
        </View>
        <Text style={{ fontFamily: theme.fonts.regular, fontSize: 12.5, lineHeight: 18, color: theme.muted }}>
          Quiet hours {preferences.quietStart}–{preferences.quietEnd}: extra nudges and check-ins are skipped, but a
          task you scheduled for that time still reminds you. Your phone’s Focus or Do Not Disturb can still
          silence reminders.
        </Text>
        <Text
          onPress={() => router.navigate("/notification-test")}
          style={{ fontFamily: theme.fonts.semibold, fontSize: 13, color: theme.accent }}
        >
          How reminders work
        </Text>
      </View>
    </>
  );
}
