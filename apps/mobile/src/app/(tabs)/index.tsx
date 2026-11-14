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
  Icon,
  Notice,
  Reveal,
  Tap,
  theme,
  type IconName,
} from "../../components/ui";
import { DailyWrapUp, DayAdjustment } from "../../components/day-adjustments";
import { DayCapture } from "../../components/day-capture";
import { useTempo, isSharedId, sharedPlanTasks } from "../../data/store";
import {
  DoneToday,
  Invitations,
  ProjectStrip,
  TeamTasks,
} from "../../components/today-extras";
import { ReminderPrompt } from "../../components/reminder-card";
import { TempoSays, helperMessage, talk } from "../../components/helper";
import { NowCard } from "../../components/now-card";
import { DayList } from "../../components/day-list";
import { progress } from "../../../../../packages/core/src/progress";
import { replanFromNow } from "../../lib/replan";
import { localParts } from "../../../../../packages/core/src/scheduling";
import { buildDay } from "../../../../../packages/core/src/day-planner";

export default function Today() {
  const { tasks, routines, preferences, save, saveTasks, shares, projects } = useTempo();
  const firstName = useTempo((s) => s.user?.name.trim().split(/\s+/)[0] ?? "");
  const [now, setNow] = useState(new Date());
  const [message, setMessage] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
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
  const clockOf = (t?: { scheduledAt: string | null }) =>
    t?.scheduledAt ? localParts(new Date(t.scheduledAt), preferences.timezone).clock : undefined;
  const helper = helperMessage({
    name: firstName,
    hour,
    isToday: day === todayDate,
    hasDay,
    next,
    nextClock: clockOf(next),
    minutesUntilNext: next ? Math.ceil((Date.parse(next.scheduledAt!) - now.getTime()) / 60000) : 0,
    missed,
    missedClock: clockOf(missed[0]),
    remaining: remaining.length,
    minutesLeft,
    waiting: waiting.length,
    overdue: overdue.length,
    allDone: hasDay && allDone,
    replan: async () => {
      const result = await replanFromNow();
      setNow(new Date());
      return result;
    },
  });
  const stats = progress(tasks, todayDate, preferences.timezone);
  const projectTitle = (id?: string | null) => projects.find((p) => p.id === id)?.title;
  return (
    <Screen
      title={
        day === todayDate
          ? `${greeting}${firstName ? "," : "."}`
          : "A head start."
      }
      titleAccent={day === todayDate && firstName ? `${firstName}.` : undefined}
    >
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <StatusPill icon="bolt" tint={stats.streak ? theme.sun : theme.faint} label={`${stats.streak}-day streak`} />
        {stats.today.planned > 0 && (
          <StatusPill icon="doneAll" tint={theme.progress} label={`${stats.today.score}% done today`} />
        )}
        <StatusPill icon="sparkle" tint={theme.violet} label={`${stats.points.toLocaleString()} pts`} />
      </View>
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
      <Invitations />
      {next && (
        <Reveal delay={40}>
          <NowCard key={next.id} task={next} project={projectTitle(next.projectId)} />
        </Reveal>
      )}
      {hasDay && !next && allDone && (
        <Reveal delay={40}>
          <Card style={{ alignItems: "center", gap: 8, paddingVertical: 26, backgroundColor: theme.mintSoft, borderColor: "transparent" }}>
            <Icon name="doneAll" size={30} color={theme.mintDeep} />
            <Text style={{ fontFamily: theme.fonts.display, fontSize: 32, color: theme.ink }}>All done for today.</Text>
            <Button title="See your day" icon="sparkle" compact variant="secondary" onPress={() => router.navigate("/celebrate")} />
          </Card>
        </Reveal>
      )}
      <Reveal delay={80}>
        <TempoSays text={helper.text} suggestions={helper.suggestions} />
      </Reveal>
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
          {!!missed.length && (
            <Card style={{ backgroundColor: theme.sunSoft, borderColor: "transparent" }}>
              <SectionHeader
                icon="history"
                title="Did these happen?"
                detail="Their time has passed. Mark them done, or ask Tempo to find a new time."
              />
              {missed.map((t) => (
                <TaskLine
                  key={t.id}
                  title={t.title}
                  detail={localParts(new Date(t.scheduledAt!), preferences.timezone).clock}
                >
                  <Action
                    title="Done"
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
                  <Button
                    title="Move"
                    variant="light"
                    compact
                    onPress={() => talk(`I didn't do ${t.title}. Find it a new time.`)}
                  />
                </TaskLine>
              ))}
            </Card>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ fontFamily: theme.fonts.heavy, fontSize: 19, color: theme.ink, letterSpacing: -0.3 }}>
              {day === todayDate ? "Today" : day}
            </Text>
            <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 13, color: theme.muted }}>
              {completed}/{today.length} done · {minutesLeft} min left
            </Text>
          </View>
          <DayList blocks={blocks} timezone={preferences.timezone} now={now.getTime()} />
          {!!waiting.length && (
            <Card style={{ backgroundColor: theme.accentSoft, borderColor: "transparent" }}>
              <SectionHeader
                icon="history"
                title="Waiting for a time"
                detail="Saved, but not placed yet. Replan to fit them in, or push them to tomorrow."
              />
              {waiting.map((t) => (
                <TaskLine key={t.id} title={t.title} detail={t.note || `${t.duration} min`}>
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
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Action title="Replan from now" icon="sync" variant="secondary" compact style={{ flexGrow: 1 }} run={async () => {
              const result = await replanFromNow();
              setNow(new Date());
              setMessage(result);
            }} />
            <Button
              title="My day changed"
              icon="tune"
              variant="secondary"
              compact
              style={{ flexGrow: 1 }}
              onPress={() => setAdjusting(!adjusting)}
            />
            <Button
              title="Add more"
              icon="add"
              variant="secondary"
              compact
              style={{ flexGrow: 1 }}
              onPress={() => router.navigate("/planning")}
            />
          </View>
          {adjusting && <DayAdjustment key={day} day={day} onClose={() => setAdjusting(false)} />}
          {!!message && <Notice tone="mint">{message}</Notice>}
          {confirmClear ? (
            <View style={{ gap: 10, padding: 14, borderRadius: 16, backgroundColor: theme.dangerSoft }}>
              <Text style={{ fontFamily: theme.fonts.medium, fontSize: 13.5, lineHeight: 20, color: theme.danger }}>
                Delete all {today.length} {today.length === 1 ? "task" : "tasks"} on this day, done or not? This
                can’t be undone. Repeating tasks only skip this day.
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button title="Keep them" variant="light" compact style={{ flex: 1 }} onPress={() => setConfirmClear(false)} />
                <Action
                  title="Delete all"
                  busyTitle="Deleting…"
                  icon="delete"
                  compact
                  style={{ flex: 1 }}
                  run={async () => {
                    await useTempo.getState().removeTasks(today.map((t) => t.id));
                    setConfirmClear(false);
                    setMessage("Day cleared. Tell Tempo your new plan whenever you’re ready.");
                  }}
                />
              </View>
            </View>
          ) : (
            <Button
              title="Clear this day"
              icon="delete"
              variant="ghost"
              compact
              style={{ alignSelf: "flex-start" }}
              onPress={() => {
                setMessage("");
                setConfirmClear(true);
              }}
            />
          )}
          <TeamTasks />
          <ProjectStrip />
          <DoneToday tasks={doneToday} />
        </>
      )}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
        <Shortcut icon="routine" label="My week" onPress={() => router.navigate("/my-week")} />
        <Shortcut icon="event" label="Calendar" onPress={() => router.navigate("/calendar")} />
        <Shortcut icon="inbox" label="Inbox" onPress={() => router.navigate("/inbox")} />
        <Shortcut icon="list" label="All tasks" onPress={() => router.navigate("/tasks")} />
      </View>
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

function StatusPill({ icon, tint, label }: { icon: IconName; tint: string; label: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 11,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.line,
      }}
    >
      <Icon name={icon} size={15} color={tint} />
      <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 12.5, color: theme.inkSoft }}>{label}</Text>
    </View>
  );
}

function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        gap: 6,
        paddingVertical: 12,
        borderRadius: 18,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.line,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.accentSoft,
        }}
      >
        <Icon name={icon} size={19} color={theme.accentDeep} />
      </View>
      <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 12, color: theme.inkSoft }}>
        {label}
      </Text>
    </Tap>
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
