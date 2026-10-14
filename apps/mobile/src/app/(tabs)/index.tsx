import { router } from "expo-router";
import { View, Text } from "react-native";
import {
  Screen,
  Card,
  Heading,
  Body,
  Button,
  Label,
  ProgressHero,
  theme,
} from "../../components/ui";
import { useTempo } from "../../data/store";
import { localParts } from "../../../../../packages/core/src/scheduling";
export default function Today() {
  const { tasks, projects, preferences } = useTempo();
  const day = localParts(new Date(), preferences.timezone).date;
  const scheduled = tasks
    .filter(
      (t) =>
        t.scheduledAt &&
        localParts(new Date(t.scheduledAt), preferences.timezone).date === day,
    )
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
  const next =
    scheduled.find((t) => t.status === "pending") ??
    tasks.find((t) => t.status === "pending");
  return (
    <Screen
      eyebrow="YOUR PERSONAL OPERATING SYSTEM"
      title="Own your day."
      subtitle="A clear plan. Protected energy. Meaningful progress."
    >
      <ProgressHero
        label="TODAY’S PROGRESS"
        completed={scheduled.filter((t) => t.status === "completed").length}
        total={scheduled.length}
      />
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          {
            value: tasks.filter((t) => t.status === "pending").length,
            label: "Open tasks",
          },
          { value: projects.length, label: "Projects" },
          {
            value: scheduled.reduce((n, t) => n + t.duration, 0),
            label: "Planned min",
          },
        ].map((metric) => (
          <Card key={metric.label} style={{ flex: 1, padding: 16, gap: 8 }}>
            <Text
              style={{
                fontFamily: theme.fonts.bold,
                fontSize: 28,
                color: theme.ink,
              }}
            >
              {metric.value}
            </Text>
            <Body small>{metric.label}</Body>
          </Card>
        ))}
      </View>
      <Card
        onPress={() => router.navigate("/planning")}
        label="Open daily planning"
        style={{ backgroundColor: theme.accentSoft }}
      >
        <Label>DAILY RESET</Label>
        <Heading>Turn a busy mind into a clear plan.</Heading>
        <Body>Make room for your priorities, meals, movement, and rest.</Body>
        <Text
          style={{
            fontFamily: theme.fonts.bold,
            fontSize: 16,
            color: theme.ink,
          }}
        >
          Build today’s plan →
        </Text>
      </Card>
      <View style={{ gap: 16, marginTop: 10 }}>
        <Label>FOCUS RIGHT NOW</Label>
        <Card style={{ minHeight: 190 }}>
          {next ? (
            <>
              <Body>
                {(
                  projects.find((p) => p.id === next.projectId)?.title ??
                  "PERSONAL"
                ).toUpperCase()}{" "}
                · {next.duration} MINUTES
              </Body>
              <Heading size={24}>{next.title}</Heading>
              <View style={{ alignSelf: "flex-start", marginTop: 8 }}>
                <Button
                  title="Start focus session"
                  onPress={() =>
                    router.navigate({
                      pathname: "/tasks",
                      params: { focus: next.id },
                    })
                  }
                />
              </View>
            </>
          ) : (
            <>
              <Heading>Space for your next commitment.</Heading>
              <Body>Add a task, then create a realistic day plan.</Body>
              <Button
                title="+ Add task"
                onPress={() => router.navigate("/tasks")}
              />
            </>
          )}
        </Card>
      </View>
      <View style={{ gap: 6, marginTop: 10 }}>
        <Heading>TODAY’S TIMELINE</Heading>
        {scheduled.length ? (
          scheduled.map((t) => (
            <Card
              key={t.id}
              style={{
                paddingVertical: 18,
                paddingHorizontal: 15,
                minHeight: 68,
              }}
              onPress={() => router.navigate("/tasks")}
              label={`Open ${t.title}`}
            >
              <Body>
                {
                  localParts(new Date(t.scheduledAt!), preferences.timezone)
                    .clock
                }{" "}
                {t.title}
                {t.status === "completed" ? "  ✓" : ""}
              </Body>
            </Card>
          ))
        ) : (
          <Card>
            <Body>No scheduled tasks yet.</Body>
            <Button
              title="✦ Create my plan"
              onPress={() => router.navigate("/planning")}
            />
          </Card>
        )}
      </View>
      {!preferences.onboardingComplete && (
        <Button
          title="Get started"
          onPress={() => router.push("/onboarding")}
        />
      )}
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Button title="Routines" onPress={() => router.navigate("/health")} />
        <Button title="Reports" onPress={() => router.push("/reports")} />
        <Button title="Settings" onPress={() => router.navigate("/settings")} />
      </View>
    </Screen>
  );
}
