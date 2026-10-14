import { useState } from "react";
import { TextInput, Text, View } from "react-native";
import {
  Screen,
  Card,
  Body,
  Field,
  Action,
  Label,
  theme,
  Button,
} from "../../components/ui";
import { useTempo, id, type Task } from "../../data/store";
import {
  localParts,
  planDay,
  planningStart,
} from "../../../../../packages/core/src/scheduling";
export default function Planning() {
  const { tasks, routines, preferences, saveTasks } = useTempo();
  const [day, setDay] = useState(
    localParts(new Date(), preferences.timezone).date,
  );
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const priorities = tasks.filter((t) => t.status === "pending").slice(0, 3);
  return (
    <Screen
      eyebrow="MORNING BRIEFING"
      title="Make space for what matters."
      subtitle="Tell your assistant everything on your mind."
    >
      <Card style={{ padding: 18, paddingBottom: 24, gap: 16 }}>
        <Label>WHAT NEEDS TO GET DONE?</Label>
        <TextInput
          accessibilityLabel="Tasks to plan, one per line"
          value={draft}
          onChangeText={setDraft}
          placeholder="Add one task per line, or plan your existing tasks…"
          placeholderTextColor={theme.muted}
          multiline
          style={{
            backgroundColor: theme.background,
            borderRadius: 12,
            padding: 13,
            minHeight: 180,
            textAlignVertical: "top",
            fontFamily: theme.fonts.regular,
            fontSize: 16,
            color: theme.ink,
          }}
        />
        <Action
          title="✦ Create my plan"
          run={async () => {
            const added: Task[] = draft
              .split("\n")
              .map((t) => t.trim())
              .filter(Boolean)
              .map((title) => ({
                id: id(),
                title,
                duration: 25,
                projectId: null,
                status: "pending",
                scheduledAt: null,
                completedAt: null,
              }));
            const start = planningStart(day, preferences.timezone, new Date());
            const plan = planDay(
              [...tasks, ...added],
              routines,
              day,
              preferences.timezone,
              start,
            );
            await saveTasks([...plan.scheduled, ...plan.unscheduled]);
            setDraft("");
            setMessage(
              `Saved ${plan.scheduled.length} scheduled tasks. ${plan.unscheduled.length} could not fit.`,
            );
          }}
        />
      </Card>
      <View style={{ gap: 15, marginTop: 12 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bold,
            fontSize: 16,
            color: theme.ink,
          }}
        >
          TOP 3 PENDING TASKS
        </Text>
        {priorities.map((t, i) => (
          <Card
            key={t.id}
            style={{
              minHeight: 65,
              flexDirection: "row",
              alignItems: "center",
              padding: 17,
              gap: 18,
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.bold,
                fontSize: 15,
                color: theme.accent,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.bold,
                fontSize: 16,
                color: theme.ink,
                flex: 1,
              }}
            >
              {t.title}
            </Text>
          </Card>
        ))}
      </View>
      {message && <Body>{message}</Body>}
      <Body>
        Local planner · AI not connected. New entries use a 25-minute estimate;
        edit durations in Tasks. Protected routines and existing schedules stay
        fixed.
      </Body>
      <Button
        title={`Plan date · ${day}`}
        onPress={() => setDateOpen(!dateOpen)}
      />
      {dateOpen && (
        <Card>
          <Field
            label="Plan date YYYY-MM-DD"
            value={day}
            onChangeText={setDay}
          />
        </Card>
      )}
    </Screen>
  );
}
