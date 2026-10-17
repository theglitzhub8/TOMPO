import { useState } from "react";
import { router } from "expo-router";
import {
  Screen,
  Card,
  Heading,
  Body,
  Button,
  Field,
  Action,
} from "../../components/ui";
import { BackendConnection } from "../../components/backend-connection";
import { useTempo } from "../../data/store";
export default function Settings() {
  const { preferences, save } = useTempo();
  const [timezone, setTimezone] = useState(preferences.timezone);
  return (
    <Screen
      eyebrow="MAKE IT YOURS"
      title="Around your life."
      subtitle="A little setup, when you need it."
    >
      <BackendConnection />
      <Card>
        <Heading small>Your timezone</Heading>
        <Body>Your plan and appointment times follow this timezone.</Body>
        <Field label="Timezone" value={timezone} onChangeText={setTimezone} />
        <Action
          title="Save timezone"
          run={async () => {
            await save("preferences", {
              ...preferences,
              timezone: timezone.trim(),
            });
          }}
        />
      </Card>
      <Card>
        <Heading small>Things that already have a time</Heading>
        <Body>
          Add regular meals, school runs, or other routines. Tempo plans around
          them.
        </Body>
        <Button
          title="Manage my routines"
          onPress={() => router.navigate("/health")}
        />
      </Card>
      <Card>
        <Heading small>Your tasks</Heading>
        <Body>
          Edit tasks, change appointment times, and see things waiting for
          another day.
        </Body>
        <Button
          title="View all tasks"
          onPress={() => router.navigate("/tasks")}
        />
      </Card>
      <Card>
        <Heading small>Voice and text</Heading>
        <Body>
          Tap Tell Tempo to speak or type everything in one go. You can edit the
          transcript before planning. Speech uses your phone’s recognition
          service and may need internet.
        </Body>
        <Body small>
          On an older build, use the microphone on your keyboard to dictate into
          the same input.
        </Body>
      </Card>
      <Body small>
        Your plan follows your account across devices. Background reminders are
        not connected.
      </Body>
    </Screen>
  );
}
