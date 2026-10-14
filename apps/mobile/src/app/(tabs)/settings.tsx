import { useState } from "react";
import { router } from "expo-router";
import { Screen, Card, Heading, Body, Button } from "../../components/ui";
import { PreferencesForm } from "../../components/preferences";
import { useTempo } from "../../data/store";
export default function Settings() {
  const { preferences } = useTempo();
  const [editing, setEditing] = useState(false);
  return (
    <Screen
      eyebrow="PERSONALIZATION"
      title="Set your standards."
      subtitle="Make accountability work for you."
    >
      <Card
        style={{
          minHeight: 70,
          paddingHorizontal: 18,
          paddingVertical: 16,
          gap: 7,
        }}
        onPress={() => setEditing(!editing)}
        label="Configure accountability mode"
      >
        <Heading small>Accountability mode</Heading>
        <Body small>{preferences.mode} · configurable</Body>
      </Card>
      <Card
        style={{
          minHeight: 70,
          paddingHorizontal: 18,
          paddingVertical: 16,
          gap: 7,
        }}
        onPress={() => router.push("/notification-test")}
        label="Notification preferences"
      >
        <Heading small>Notification preferences</Heading>
        <Body small>Integration pending · view capabilities</Body>
      </Card>
      <Card
        style={{
          minHeight: 70,
          paddingHorizontal: 18,
          paddingVertical: 16,
          gap: 7,
        }}
        onPress={() => router.navigate("/assistant")}
        label="In-app voice calls"
      >
        <Heading small>In-app voice calls</Heading>
        <Body small>Simulation only · available after integration</Body>
      </Card>
      <Card
        style={{
          minHeight: 70,
          paddingHorizontal: 18,
          paddingVertical: 16,
          gap: 7,
        }}
      >
        <Heading small>Telephone backup</Heading>
        <Body small>Provider setup required</Body>
      </Card>
      <Card
        style={{
          minHeight: 70,
          paddingHorizontal: 18,
          paddingVertical: 16,
          gap: 7,
        }}
        onPress={() => setEditing(!editing)}
        label="Configure quiet hours"
      >
        <Heading small>Sleep protection</Heading>
        <Body small>
          Quiet hours {preferences.quietStart}–{preferences.quietEnd}
        </Body>
      </Card>
      <Card
        style={{
          minHeight: 70,
          paddingHorizontal: 18,
          paddingVertical: 16,
          gap: 7,
        }}
        onPress={() => setEditing(!editing)}
        label="Configure timezone"
      >
        <Heading small>Time zone · {preferences.timezone}</Heading>
        <Body small>
          {
            new Intl.DateTimeFormat("en-US", {
              timeZone: preferences.timezone,
              timeZoneName: "longOffset",
            })
              .formatToParts(new Date())
              .find((p) => p.type === "timeZoneName")?.value
          }
        </Body>
      </Card>
      {editing && <PreferencesForm />}
      <Button
        title="Personal preferences"
        onPress={() => router.push("/onboarding")}
      />
      <Button title="Routines" onPress={() => router.navigate("/health")} />
      <Button
        title="Accountability reports"
        onPress={() => router.push("/reports")}
      />
    </Screen>
  );
}
