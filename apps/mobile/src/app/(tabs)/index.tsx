import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import {
  Screen,
  Card,
  Heading,
  Body,
  Button,
  Action,
  Chip,
  Eyebrow,
  Icon,
  Notice,
  Progress,
  Reveal,
  theme,
  type IconName,
} from "../../components/ui";
import { DailyWrapUp, DayAdjustment } from "../../components/day-adjustments";
import { NextStepActions } from "../../components/next-step";
import { DayCapture } from "../../components/day-capture";
import { DayTimeline } from "../../components/day-timeline";
import { useTempo, isSharedId, sharedPlanTasks } from "../../data/store";
import {
  DoneToday,
  Invitations,
  ProjectStrip,
  TeamTasks,
} from "../../components/today-extras";
import { ReminderPrompt } from "../../components/reminder-card";
import { shadow } from "../../design/tokens";
import { localParts } from "../../../../../packages/core/src/scheduling";
import { buildDay } from "../../../../../packages/core/src/day-planner";

export default function Today() {
  const { tasks, routines, preferences, save, saveTasks, shares } = useTempo();
  const firstName = useTempo((s) => s.user?.name.trim().split(/\s+/)[0] ?? "");
  const [now, setNow] = useState(new Date());
  const [message, setMessage] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [recurrenceError, setRecurrenceError] = useState("");
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
  useEffect(() => {
    void useTempo.getState().refreshRecurring().catch(e => setRecurrenceError(e instanceof Error ? e.message : "Could not prepare repeating tasks."));
  }, [todayDate]);
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
        [
          ...tasks.filter((t) => t.scheduledAt),
          ...sharedPlanTasks(shares.incoming),
        ],
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
      b.kind !== "task" ||
      isSharedId(b.id) ||
      tasks.some((t) => t.id === b.id && t.scheduledAt),
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
  const doneToday = tasks.filter(
    (t) =>
      t.status === "completed" &&
      t.completedAt &&
      localParts(new Date(t.completedAt), preferences.timezone).date === todayDate,
  );
  const hour = Number(localParts(now, preferences.timezone).clock.slice(0, 2));
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const minutesLeft = remaining.reduce((sum, t) => sum + t.duration, 0);
  const allDone = remaining.length === 0 && completed === today.length;
  return (
    <Screen
      eyebrow={day === todayDate ? "ONE DAY AT A TIME" : `YOUR PLAN · ${day}`}
      title={
        day === todayDate
          ? `${greeting}${firstName ? "," : "."}`
          : "A little head start."
      }
      titleAccent={day === todayDate && firstName ? `${firstName}.` : undefined}
      subtitle={
        hasDay
          ? "Your day is laid out. Take it one thing at a time."
          : "Tell me what you need to do. I’ll help you find time for it."
      }
    >
      {day !== todayDate && (
        <Button
          title="Back to today"
          icon="back"
          variant="secondary"
          compact
          style={{ alignSelf: "flex-start" }}
          onPress={() => router.setParams({ date: todayDate })}
        />
      )}
      {plan.warnings.map((warning, i) => (
        <Notice key={i} tone="danger">
          {warning}
        </Notice>
      ))}
      {!!recurrenceError && <Notice tone="danger">{recurrenceError}</Notice>}
      <View style={{flexDirection:"row",gap:8,flexWrap:"wrap"}}>
        <Button title="Plan the week" compact variant="secondary" onPress={()=>router.navigate("/week")}/>
        <Button title="Activity inbox" compact variant="secondary" onPress={()=>router.navigate("/inbox")}/>
      </View>
      <Invitations />
      <ReminderPrompt
        upcoming={
          remaining.filter((t) => Date.parse(t.scheduledAt!) > now.getTime()).length
        }
      />
      {!hasDay ? (
        <>
          <DayCapture />
          <TeamTasks />
          <ProjectStrip />
          <DoneToday tasks={doneToday} />
        </>
      ) : (
        <>
          <Reveal delay={80}>
            <Card dark style={{ gap: 18, padding: 24 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Eyebrow light>
                  {next
                    ? Date.parse(next.scheduledAt!) <= now.getTime()
                      ? "YOUR NEXT STEP"
                      : `UP NEXT · ${localParts(new Date(next.scheduledAt!), preferences.timezone).clock}`
                    : allDone
                      ? "YOU DID IT"
                      : "ROOM FOR WHAT’S NEXT"}
                </Eyebrow>
                <Text
                  style={{
                    fontFamily: theme.fonts.semibold,
                    fontSize: 12.5,
                    color: theme.darkMuted,
                  }}
                >
                  {completed}/{today.length} done
                </Text>
              </View>
              <Heading light serif size={36}>
                {next?.title ||
                  (completed === today.length
                    ? "Your day’s work is done."
                    : "Nothing scheduled right now.")}
              </Heading>
              {next ? (
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Chip icon="timer" tone="dark">
                    {next.duration} minutes
                  </Chip>
                  <Chip icon={next.fixed !== false ? "event" : "bolt"} tone="dark">
                    {next.fixed !== false
                      ? "Fixed appointment"
                      : "One thing at a time"}
                  </Chip>
                </View>
              ) : (
                <Body light>
                  {waiting.length
                    ? "Some tasks are waiting for space. Adjust the plan when you’re ready."
                    : "Take a moment to enjoy the space you’ve made."}
                </Body>
              )}
              {!!next?.steps?.length && (
                <View
                  style={{
                    gap: 10,
                    padding: 16,
                    borderRadius: 18,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderWidth: 1,
                    borderColor: theme.darkLine,
                  }}
                >
                  {next.steps.map((step, i) => (
                    <View
                      key={i}
                      style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "rgba(185,230,211,0.14)",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: theme.fonts.bold,
                            fontSize: 11,
                            color: theme.mint,
                          }}
                        >
                          {i + 1}
                        </Text>
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: theme.fonts.regular,
                          fontSize: 14.5,
                          lineHeight: 22,
                          color: theme.surface,
                          opacity: 0.88,
                        }}
                      >
                        {step}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <Progress
                completed={completed}
                total={today.length}
                dark
                showLabel={false}
              />
              {next && <NextStepActions key={next.id} task={next} />}
            </Card>
          </Reveal>
          <Reveal delay={160} style={{ flexDirection: "row", gap: 10 }}>
            <Stat icon="doneAll" value={`${completed}/${today.length}`} label="Done" />
            <Stat icon="timer" value={`${minutesLeft}`} label="Minutes left" />
            <Stat
              icon="history"
              value={`${waiting.length}`}
              label="Waiting"
              tint={waiting.length ? theme.accent : undefined}
            />
          </Reveal>
          <Reveal delay={220} style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Button
              title="Tell Tempo more"
              icon="add"
              variant="secondary"
              compact
              style={{ flex: 1, minWidth: 130 }}
              onPress={() => router.navigate("/planning")}
            />
            <Action title="Replan from now" icon="sync" variant="secondary" compact style={{ flex: 1, minWidth: 130 }} run={async () => {
              const current = useTempo.getState();
              const revised = buildDay([...current.tasks, ...sharedPlanTasks(current.shares.incoming)].sort((a,b) => (a.scheduledAt || "z").localeCompare(b.scheduledAt || "z")), current.routines, day,
                current.preferences.timezone, new Date(), current.preferences.dayEnd || "21:00", true);
              const changed = revised.tasks.filter(t => !isSharedId(t.id) && current.tasks.some(old => old.id === t.id && old.scheduledAt !== t.scheduledAt));
              await current.saveReviewedPlan(changed, current.preferences.dayEnd || "21:00", current.revision);
              setNow(new Date());
              setMessage(`Plan updated. ${revised.overflow.length} tasks waiting for space.${revised.warnings.length ? ` ${revised.warnings.join(" ")}` : ""}`);
            }} />
            <Button
              title="My day changed"
              icon="sync"
              variant="secondary"
              compact
              style={{ flex: 1, minWidth: 130 }}
              onPress={() => setAdjusting(!adjusting)}
            />
          </Reveal>
          {adjusting && <DayAdjustment key={day} day={day} onClose={() => setAdjusting(false)} />}
          {!!message && <Notice tone="mint">{message}</Notice>}
          {!!missed.length && (
            <Card>
              <SectionHeader
                icon="history"
                title="Earlier appointments"
                detail="These times have passed. Mark them done or edit the time if plans changed."
              />
              {missed.map((t) => (
                <TaskLine
                  key={t.id}
                  title={t.title}
                  detail={
                    localParts(new Date(t.scheduledAt!), preferences.timezone)
                      .clock
                  }
                >
                  <Action
                    title="Mark done"
                    icon="check"
                    compact
                    run={async () => {
                      await save("task", {
                        ...t,
                        status: "completed",
                        completedAt: new Date().toISOString(),
                      });
                    }}
                  />
                </TaskLine>
              ))}
            </Card>
          )}
          <View style={{ marginTop: 12 }}>
            <SectionHeader
              icon="calendar"
              title="Your day at a glance"
              detail={`${preferences.timezone} · appointments stay fixed · gaps leave room to reset`}
            />
          </View>
          <DayTimeline
            blocks={blocks}
            timezone={preferences.timezone}
            now={now.getTime()}
          />
          {!!waiting.length && (
            <Card style={{ backgroundColor: theme.accentSoft, borderColor: "transparent" }}>
              <SectionHeader
                icon="history"
                title="Waiting for a little space"
                detail="These tasks are saved. You don’t have to squeeze everything into today."
              />
              {waiting.map((t) => (
                <TaskLine key={t.id} title={t.title} detail={`${t.duration} min`}>
                  <Action
                    title="Tomorrow"
                    trailingIcon="arrow"
                    variant="light"
                    compact
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
                </TaskLine>
              ))}
            </Card>
          )}
          <TeamTasks />
          <ProjectStrip />
          <DoneToday tasks={doneToday} />
          <Button
            title="Edit tasks or appointment times"
            icon="edit"
            variant="ghost"
            onPress={() => router.navigate("/tasks")}
          />
        </>
      )}
      <DailyWrapUp key={day} day={day} />
      {!!overdue.length && (
        <Card>
          <SectionHeader
            icon="redo"
            title="A few things carried over"
            detail={`${overdue.length} unfinished ${overdue.length === 1 ? "task" : "tasks"} from earlier days.`}
          />
          <Action
            title="Find room in this plan"
            icon="sparkle"
            run={async () => {
              const ids = new Set(overdue.map((t) => t.id));
              const current = useTempo.getState();
              const updated = current.tasks.map((t) =>
                ids.has(t.id)
                  ? { ...t, plannedDay: day, scheduledAt: null }
                  : t,
              );
              const revised = buildDay(
                [...updated, ...sharedPlanTasks(current.shares.incoming)],
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

function Stat({
  icon,
  value,
  label,
  tint,
}: {
  icon: IconName;
  value: string;
  label: string;
  tint?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 14,
        gap: 10,
        borderRadius: 20,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.line,
        ...shadow.soft,
      }}
    >
      <Icon name={icon} size={18} color={tint ?? theme.muted} />
      <View style={{ gap: 1 }}>
        <Text
          style={{
            fontFamily: theme.fonts.display,
            fontSize: 30,
            lineHeight: 32,
            color: tint ?? theme.ink,
          }}
        >
          {value}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: theme.fonts.semibold,
            fontSize: 12,
            color: theme.muted,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  detail,
}: {
  icon: IconName;
  title: string;
  detail?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name={icon} size={19} color={theme.accent} />
        <Heading small>{title}</Heading>
      </View>
      {detail && <Body small>{detail}</Body>}
    </View>
  );
}

function TaskLine({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: theme.line,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ fontFamily: theme.fonts.semibold, fontSize: 15, color: theme.ink }}
        >
          {title}
        </Text>
        <Text
          style={{ fontFamily: theme.fonts.medium, fontSize: 12.5, color: theme.muted }}
        >
          {detail}
        </Text>
      </View>
      {children}
    </View>
  );
}
