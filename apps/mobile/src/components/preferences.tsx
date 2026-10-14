import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useTempo } from "../data/store";
import { Field, Action, Body, Card, theme } from "./ui";
export function PreferencesForm({
  onboarding = false,
}: {
  onboarding?: boolean;
}) {
  const { preferences, save } = useTempo();
  const [timezone, setTimezone] = useState(preferences.timezone);
  const [mode, setMode] = useState(preferences.mode);
  const [quietStart, setStart] = useState(preferences.quietStart);
  const [quietEnd, setEnd] = useState(preferences.quietEnd);
  return (
    <Card>
      <Field
        label="IANA timezone"
        value={timezone}
        onChangeText={setTimezone}
      />
      <Body>
        Accountability: {mode}. Gentle: initial reminder only. Firm: at most one
        follow-up. Strict: at most two, ten minutes apart.
      </Body>
      <ModeOptions value={mode} onChange={setMode} />
      <Field
        label="Quiet hours start HH:mm"
        value={quietStart}
        onChangeText={setStart}
      />
      <Field
        label="Quiet hours end HH:mm"
        value={quietEnd}
        onChangeText={setEnd}
      />
      <Body>
        Equal start and end means quiet all day. Reminder delivery is not
        connected in this foundation.
      </Body>
      <Action
        title={onboarding ? "Start my day" : "Save preferences"}
        run={async () => {
          await save("preferences", {
            ...preferences,
            timezone: timezone.trim(),
            mode,
            quietStart,
            quietEnd,
            onboardingComplete: onboarding || preferences.onboardingComplete,
          });
          if (onboarding) router.replace("/");
        }}
      />
    </Card>
  );
}

export function ModeOptions({
  value,
  onChange,
  disabled = false,
}: {
  value: "Gentle" | "Firm" | "Strict";
  onChange: (mode: "Gentle" | "Firm" | "Strict") => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: "row", gap: 24, flexWrap: "wrap" }}
    >
      {(["Gentle", "Firm", "Strict"] as const).map((mode) => (
        <Pressable
          key={mode}
          accessibilityRole="radio"
          accessibilityLabel={mode}
          accessibilityState={{ checked: value === mode, disabled }}
          disabled={disabled}
          onPress={() => onChange(mode)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bold,
              fontSize: 13,
              color: theme.accent,
            }}
          >
            {mode}
            {value === mode ? " ✓" : ""}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
