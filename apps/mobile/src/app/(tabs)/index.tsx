import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import {
  Screen,
  Card,
  Heading,
  Body,
  Button,
  Action,
  Label,
  Progress,
  theme,
} from "../../components/ui";
import { DayCapture } from "../../components/day-capture";
import { DayTimeline } from "../../components/day-timeline";
import { useTempo } from "../../data/store";
import { localParts } from "../../../../../packages/core/src/scheduling";
import { buildDay } from "../../../../../packages/core/src/day-planner";

export default function Today() {
  const { tasks, routines, preferences, save, saveTasks } = useTempo();
  const [now, setNow] = useState(new Date());
  const [message, setMessage] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const { date } = useLocalSearchParams<{ date?: string }>();
  const todayDate = localParts(now, preferences.timezone).date;
  const day =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= todayDate
      ? date
      : todayDate;
  const today = tasks.filter(
    (t) =>
      t.plannedDay === day ||
      (t.scheduledAt &&
        localParts(new Date(t.scheduledAt), preferences.timezone).date === day),
  );
  const scheduled = today
    .filter((t) => t.scheduledAt)
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
  const remaining = scheduled.filter((t) => t.status === "pending");
  const missed = remaining.filter(
    (t) =>
      t.fixed !== false &&
      Date.parse(t.scheduledAt!) + t.duration * 60000 <= now.getTime(),
  );
  const next = remaining.find((t) => !missed.some((m) => m.id === t.id));
  const completed = today.filter((t) => t.status === "completed").length;
  const plan = (() => {
    try {
      return buildDay(
        tasks.filter((t) => t.scheduledAt),
        routines,
        day,
        preferences.timezone,
        now,
        preferences.dayEnd || "21:00",
      );
    } catch (e) {
      return {
        tasks,
        blocks: [],
        overflow: [],
        warnings: [
          e instanceof Error ? e.message : "Check your planning times.",
        ],
      };
    }
  })();
  // Viewing a day never silently places waiting work. Only persisted blocks appear.
  const blocks = plan.blocks.filter(
    (b) =>
      b.kind !== "task" || tasks.some((t) => t.id === b.id && t.scheduledAt),
  );
  const waiting = today.filter((t) => t.status === "pending" && !t.scheduledAt);
  const overdue = tasks.filter(
    (t) =>
      t.status === "pending" &&
      t.fixed === false &&
      t.plannedDay &&
      t.plannedDay < day,
  );
  const hasDay = today.length > 0;
  const greeting =
    Number(localParts(now, preferences.timezone).clock.slice(0, 2)) < 12
      ? "Good morning."
      : Number(localParts(now, preferences.timezone).clock.slice(0, 2)) < 18
        ? "Make room for today."
        : "A little room to breathe.";
  return (
    <Screen
      eyebrow={day === todayDate ? "ONE DAY AT A TIME" : `YOUR PLAN · ${day}`}
      title={day === todayDate ? greeting : "A little head start."}
      subtitle={
        hasDay
          ? "Your day is laid out. Take it one thing at a time."
          : "Tell me what you need to do. I’ll help you find time for it."
      }
    >
      {day !== todayDate && (
        <Button
          title="Back to today"
          onPress={() => router.setParams({ date: todayDate })}
        />
      )}
      {plan.warnings.map((warning, i) => (
        <Card key={i}>
          <Body>{warning}</Body>
        </Card>
      ))}
      {!hasDay ? (
        <DayCapture />
      ) : (
        <>
          <Card dark style={{ gap: 16 }}>
            <Label light>
              {next
                ? Date.parse(next.scheduledAt!) <= now.getTime()
                  ? "YOUR NEXT STEP"
                  : `UP NEXT · ${localParts(new Date(next.scheduledAt!), preferences.timezone).clock}`
                : remaining.length === 0 && completed === today.length
                  ? "YOU DID IT"
                  : "ROOM FOR WHAT’S NEXT"}
            </Label>
            <Heading light size={27}>
              {next?.title ||
                (completed === today.length
                  ? "Your day’s work is done."
                  : "Nothing scheduled right now.")}
            </Heading>
            <Body light>
              {next
                ? `${next.duration} minutes${next.fixed !== false ? " · fixed appointment" : " · one thing at a time"}`
                : waiting.length
                  ? "Some tasks are waiting for space. Adjust the plan when you’re ready."
                  : "Take a moment to enjoy the space you’ve made."}
            </Body>
            {next?.steps?.map((step, i) => (
              <Body light key={i}>
                {i + 1}. {step}
              </Body>
            ))}
            {next && (
              <Action
                title="✓ Done · what’s next?"
                run={async () => {
                  await save("task", {
                    ...next,
                    status: "completed",
                    completedAt: new Date().toISOString(),
                  });
                  setNow(new Date());
                  setMessage("One less thing on your mind.");
                }}
              />
            )}
          </Card>
          <View style={{ gap: 10 }}>
            <Body>
              {completed} of {today.length} done ·{" "}
              {remaining.reduce((sum, t) => sum + t.duration, 0)} minutes
              scheduled
            </Body>
            <Progress
              completed={completed}
              total={today.length}
              showLabel={false}
            />
          </View>
          <View style={{ gap: 10 }}>
            <Button
              title="+ Tell Tempo more"
              onPress={() => router.navigate("/planning")}
            />
            <Action
              title="Plans changed · replan from now"
              run={async () => {
                const current = useTempo.getState();
                const ordered = [...current.tasks].sort((a, b) =>
                  (a.scheduledAt || "z").localeCompare(b.scheduledAt || "z"),
                );
                const revised = buildDay(
                  ordered,
                  current.routines,
                  day,
                  preferences.timezone,
                  new Date(),
                  preferences.dayEnd || "21:00",
                  true,
                );
                const changes = revised.tasks.filter(
                  (t) =>
                    !current.tasks.some(
                      (old) =>
                        old.id === t.id &&
                        JSON.stringify(old) === JSON.stringify(t),
                    ),
                );
                await saveTasks(changes);
                setNow(new Date());
                setMessage(
                  `Flexible work moved around your appointments.${revised.overflow.length ? ` ${revised.overflow.length} tasks won’t fit and are waiting below.` : " There’s room for everything."}${revised.warnings.length ? ` ${revised.warnings.join(" ")}` : ""}`,
                );
              }}
            />
          </View>
          {!!message && (
            <Card style={{ backgroundColor: theme.accentSoft, padding: 16 }}>
              <Body>{message}</Body>
            </Card>
          )}
          {!!missed.length && (
            <Card>
              <Heading small>Earlier appointments</Heading>
              <Body>
                These times have passed. Mark them done or edit the time if
                plans changed.
              </Body>
              {missed.map((t) => (
                <View key={t.id} style={{ gap: 8 }}>
                  <Body>
                    {t.title} ·{" "}
                    {
                      localParts(new Date(t.scheduledAt!), preferences.timezone)
                        .clock
                    }
                  </Body>
                  <Action
                    title={`Mark ${t.title} done`}
                    run={async () => {
                      await save("task", {
                        ...t,
                        status: "completed",
                        completedAt: new Date().toISOString(),
                      });
                    }}
                  />
                </View>
              ))}
            </Card>
          )}
          <Heading>Your day at a glance</Heading>
          <Body small>
            {preferences.timezone} · appointments stay fixed · gaps leave room
            to reset
          </Body>
          <DayTimeline blocks={blocks} timezone={preferences.timezone} />
          {!!waiting.length && (
            <Card style={{ backgroundColor: theme.accentSoft }}>
              <Heading small>Waiting for a little space</Heading>
              <Body>
                These tasks are saved. You don’t have to squeeze everything into
                today.
              </Body>
              {waiting.map((t) => (
                <View key={t.id} style={{ gap: 8 }}>
                  <Body>
                    {t.title} · {t.duration} min
                  </Body>
                  <Action
                    title="Move to tomorrow"
                    run={async () => {
                      const tomorrow = new Date(
                        Date.parse(`${day}T12:00:00Z`) + 86400000,
                      )
                        .toISOString()
                        .slice(0, 10);
                      await save("task", {
                        ...t,
                        plannedDay: tomorrow,
                        scheduledAt: null,
                        fixed: false,
                      });
                    }}
                  />
                </View>
              ))}
            </Card>
          )}
          <Button
            title="Edit tasks or appointment times"
            onPress={() => router.navigate("/tasks")}
          />
        </>
      )}
      {!!overdue.length && (
        <Card>
          <Heading small>A few things carried over</Heading>
          <Body>
            {overdue.length} unfinished{" "}
            {overdue.length === 1 ? "task" : "tasks"} from earlier days.
          </Body>
          <Action
            title="Find room in this plan"
            run={async () => {
              const ids = new Set(overdue.map((t) => t.id));
              const current = useTempo.getState();
              const updated = current.tasks.map((t) =>
                ids.has(t.id)
                  ? { ...t, plannedDay: day, scheduledAt: null }
                  : t,
              );
              const revised = buildDay(
                updated,
                current.routines,
                day,
                preferences.timezone,
                new Date(),
                preferences.dayEnd || "21:00",
              );
              await saveTasks(revised.tasks.filter((t) => ids.has(t.id)));
              setNow(new Date());
            }}
          />
        </Card>
      )}
    </Screen>
  );
}
