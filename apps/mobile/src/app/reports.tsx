import { Text, View } from "react-native";
import {
  Screen,
  Card,
  Body,
  Label,
  ProgressHero,
  theme,
} from "../components/ui";
import { useTempo } from "../data/store";
import { localParts } from "../../../../packages/core/src/scheduling";
export default function Reports() {
  const { tasks, projects, preferences } = useTempo();
  const day = localParts(new Date(), preferences.timezone).date;
  const planned = tasks.filter(
    (t) =>
      t.scheduledAt &&
      localParts(new Date(t.scheduledAt), preferences.timezone).date === day,
  );
  const done = planned.filter((t) => t.status === "completed").length;
  return (
    <Screen
      eyebrow="ACCOUNTABILITY REPORT"
      title="Your progress"
      subtitle="Measure what you actually complete."
    >
      <ProgressHero
        report
        label="TODAY’S COMPLETION RATE"
        completed={done}
        total={planned.length}
      />
      <Card
        style={{
          minHeight: 108,
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        {[
          [done, "Completed"],
          [planned.length - done, "Remaining"],
        ].map(([value, label]) => (
          <View key={label} style={{ gap: 8 }}>
            <Text
              style={{
                fontFamily: theme.fonts.bold,
                fontSize: 33,
                color: theme.accent,
              }}
            >
              {value}
            </Text>
            <Body>{label}</Body>
          </View>
        ))}
      </Card>
      <Card style={{ minHeight: 155 }}>
        <Label>PROJECT TASK COMPLETION</Label>
        {projects.length ? (
          projects.map((p) => {
            const assigned = tasks.filter((t) => t.projectId === p.id);
            const percent = assigned.length
              ? Math.round(
                  (assigned.filter((t) => t.status === "completed").length /
                    assigned.length) *
                    100,
                )
              : 0;
            return (
              <Body key={p.id}>
                {p.title} {percent}%
              </Body>
            );
          })
        ) : (
          <Body>No project tasks recorded yet.</Body>
        )}
      </Card>
      <Card style={{ minHeight: 50, padding: 16 }}>
        <Body>Review unfinished work before tomorrow.</Body>
      </Card>
      <Body>
        Calculated from local records. AI reviews and historical analytics
        remain pending.
      </Body>
    </Screen>
  );
}
