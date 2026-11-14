import { useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import {
  Card,
  Body,
  Button,
  Eyebrow,
  Field,
  Heading,
  Icon,
  Notice,
  Reveal,
  theme,
  styles,
} from "./ui";
import { VoiceInput } from "./voice-input";
import { ProjectPicker } from "./project-picker";
import { DayTimeline } from "./day-timeline";
import {
  useTempo,
  id,
  isSharedId,
  sharedPlanTasks,
  type Project,
  type Task,
} from "../data/store";
import { understandDay } from "../lib/capture";
import {
  buildDay,
  captureTasks,
  type Capture,
} from "../../../../packages/core/src/day-planner";
import { localParts } from "../../../../packages/core/src/scheduling";
import { clashText, findClashes } from "../../../../packages/core/src/clashes";

const dayName = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

// Projects that were deleted while reviewing fall back to "No project".
function withProjects(
  added: Task[],
  itemProjects: (string | null)[],
  projects: Project[],
) {
  return added.map((t, i) => ({
    ...t,
    projectId: projects.some((p) => p.id === itemProjects[i])
      ? itemProjects[i]
      : null,
  }));
}

export function DayCapture() {
  const {
    captureText: draft,
    setCaptureText: setDraft,
    tasks,
    routines,
    preferences,
    projects,
    shares,
    savePlan,
  } = useTempo();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [end, setEnd] = useState(preferences.dayEnd || "21:00");
  const [day, setDay] = useState(
    localParts(new Date(), preferences.timezone).date,
  );
  const [includeWaiting, setIncludeWaiting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [captureId, setCaptureId] = useState(id);
  // Project per captured item, aligned with capture.items by index.
  const [itemProjects, setItemProjects] = useState<(string | null)[]>([]);

  const lock = useRef(false);
  const waiting = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === "pending" && !t.scheduledAt && t.plannedDay !== day,
      ),
    [tasks, day],
  );
  const preview = useMemo(() => {
    if (!capture) return null;
    try {
      let index = 0;
      const added = withProjects(
        captureTasks(
          capture.items,
          day,
          preferences.timezone,
          () => `${captureId}-${index++}`,
        ),
        itemProjects,
        projects,
      );
      // Right after saving, the store already holds these tasks; don't count them twice.
      const addedIds = new Set(added.map((t) => t.id));
      const existing = tasks
        .filter((t) => !addedIds.has(t.id))
        .map((t) =>
          includeWaiting && waiting.some((w) => w.id === t.id)
            ? { ...t, plannedDay: day, fixed: false }
            : t,
        );
      return {
        plan: buildDay(
          [...existing, ...added, ...sharedPlanTasks(shares.incoming)],
          routines,
          day,
          preferences.timezone,
          new Date(),
          end,
        ),
        error: "",
      };
    } catch (e) {
      return {
        plan: null,
        error: e instanceof Error ? e.message : "Check your plan.",
      };
    }
  }, [
    capture,
    captureId,
    day,
    end,
    includeWaiting,
    itemProjects,
    projects,
    shares.incoming,
    preferences.timezone,
    routines,
    tasks,
    waiting,
  ]);
  const update = (index: number, changes: Partial<Capture["items"][number]>) =>
    setCapture((c) =>
      c
        ? {
            ...c,
            items: c.items.map((item, i) =>
              i === index ? { ...item, ...changes } : item,
            ),
          }
        : c,
    );
  // Tasks the person put on other days are saved there and planned when that day comes.
  const later = capture
    ? [...new Set(capture.items.map((item) => item.day).filter((d): d is string => !!d && d !== day))]
        .sort()
        .map((on) => ({ on, items: capture.items.filter((item) => item.day === on) }))
    : [];
  // Timed items that land on the regular week or an appointment.
  const clashes = useMemo(
    () =>
      (capture?.items ?? []).flatMap((item) => {
        if (!item.clock) return [];
        try {
          const found = findClashes(
            { day: item.day ?? day, clock: item.clock, duration: item.duration },
            { routines, tasks, timezone: preferences.timezone },
          );
          return found.length
            ? [`“${item.title}” at ${item.clock} clashes with ${found.map((c) => clashText(c, preferences.timezone)).join(" and ")}.`]
            : [];
        } catch {
          return [];
        }
      }),
    [capture, day, routines, tasks, preferences.timezone],
  );
  const scheduledCount =
    preview?.plan?.blocks.filter((b) => b.kind === "task").length ?? 0;
  return (
    <View style={{ gap: 16 }}>
      {!capture ? (
        <>
          <Reveal delay={80}>
            <Card style={{ gap: 20, padding: 24, borderRadius: 30 }}>
              <View style={{ gap: 10 }}>
                <Eyebrow>LET IT ALL OUT</Eyebrow>
                <Heading serif>What’s on your mind today?</Heading>
                <Body>
                  Chores, work, errands, appointments — tell me everything in
                  one go. Add times or durations if you know them. Planning the
                  week? Say “On Monday I have…, on Wednesday…”.
                </Body>
              </View>
              <VoiceInput
                value={draft}
                onChange={setDraft}
                disabled={busy}
                onListening={setListening}
              />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: theme.line }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon name="keyboard" size={16} color={theme.faint} />
                  <Text
                    style={{
                      fontFamily: theme.fonts.semibold,
                      fontSize: 12,
                      color: theme.faint,
                      letterSpacing: 0.4,
                    }}
                  >
                    or type it
                  </Text>
                </View>
                <View style={{ flex: 1, height: 1, backgroundColor: theme.line }} />
              </View>
              <View
                style={{
                  borderRadius: 22,
                  borderWidth: 1.5,
                  borderColor: focused || listening ? theme.ink : "transparent",
                  backgroundColor: focused || listening ? theme.surface : theme.background,
                  overflow: "hidden",
                }}
              >
                <TextInput
                  accessibilityLabel="Everything you need to do today"
                  value={draft}
                  onChangeText={setDraft}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  editable={!busy && !listening}
                  placeholder="I need to wash clothes, finish my proposal, buy groceries and call Mum. I have a meeting at 2pm…"
                  placeholderTextColor={theme.faint}
                  multiline
                  maxLength={12000}
                  style={{
                    minHeight: 170,
                    padding: 18,
                    textAlignVertical: "top",
                    fontFamily: theme.fonts.medium,
                    fontSize: 16,
                    lineHeight: 25,
                    color: theme.ink,
                    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
                  }}
                />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 18,
                    paddingBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.medium,
                      fontSize: 12,
                      color: theme.faint,
                    }}
                  >
                    {draft.trim()
                      ? `${draft.trim().split(/\s+/).length} words`
                      : "No need to be tidy"}
                  </Text>
                  {!!draft && !busy && !listening && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear text"
                      hitSlop={10}
                      onPress={() => setDraft("")}
                    >
                      <Text
                        style={{
                          fontFamily: theme.fonts.semibold,
                          fontSize: 12,
                          color: theme.muted,
                        }}
                      >
                        Clear
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
              <Button
                title={busy ? "Making room for your day…" : "Make my day plan"}
                variant="accent"
                icon={busy ? undefined : "sparkle"}
                trailingIcon={busy ? undefined : "arrow"}
                disabled={busy || listening || !draft.trim()}
                onPress={async () => {
                  if (lock.current) return;
                  lock.current = true;
                  setBusy(true);
                  setError("");
                  try {
                    const captureDay = localParts(
                      new Date(),
                      preferences.timezone,
                    ).date;
                    setDay(captureDay);
                    const result = await understandDay(
                      draft,
                      captureDay,
                      preferences.timezone,
                    );
                    setCaptureId(id());
                    setItemProjects(result.items.map(item => projects.find(p => p.title.toLowerCase() === item.project?.toLowerCase())?.id ?? null));
                    setCapture(result);
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Could not create your plan. Your words are still here.",
                    );
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              />
            </Card>
          </Reveal>
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              paddingHorizontal: 6,
              alignItems: "flex-start",
            }}
          >
            <Icon name="sparkle" size={16} color={theme.accent} />
            <Body small style={{ flex: 1 }}>
              You don’t need to organize anything first. Tempo will turn your
              words into tasks and find time for them.
            </Body>
          </View>
        </>
      ) : (
        <>
          <Reveal>
            <Card dark style={{ gap: 16, padding: 24 }}>
              <Eyebrow light>
                {capture.source === "ai"
                  ? "YOUR WORDS, ORGANIZED"
                  : "QUICK LOCAL PLAN"}
              </Eyebrow>
              <Heading light serif size={34}>
                Here’s room for your day.
              </Heading>
              <Body light>
                Change anything that doesn’t look right, then save your plan.
              </Body>
              {preview?.plan && (
                <View
                  style={{
                    flexDirection: "row",
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: theme.darkLine,
                    backgroundColor: "rgba(255,255,255,0.04)",
                  }}
                >
                  <DarkStat value={`${scheduledCount}`} label="Scheduled" />
                  <DarkStat
                    value={`${preview.plan.overflow.length}`}
                    label="Waiting"
                    divider
                  />
                  <DarkStat value={end} label="Finish by" divider />
                </View>
              )}
            </Card>
          </Reveal>
          {!!capture.notes.length && (
            <Card style={{ padding: 18, gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Icon name="sparkle" size={17} color={theme.accent} />
                <Text style={[styles.badge, { color: theme.inkSoft }]}>
                  NOTES FROM TEMPO
                </Text>
              </View>
              {capture.notes.map((note, i) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}
                >
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      marginTop: 8,
                      backgroundColor: theme.faint,
                    }}
                  />
                  <Body small style={{ flex: 1, color: theme.inkSoft }}>
                    {note}
                  </Body>
                </View>
              ))}
            </Card>
          )}
          {clashes.map((text, i) => (
            <Notice key={i} tone="accent" icon="event">
              {text} Change its time under Adjust tasks & hours, or keep both.
            </Notice>
          ))}
          {!!later.length && (
            <Card style={{ padding: 18, gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Icon name="calendar" size={17} color={theme.accent} />
                <Text style={[styles.badge, { color: theme.inkSoft }]}>
                  LATER THIS WEEK
                </Text>
              </View>
              {later.map(({ on, items }) => (
                <View key={on} style={{ gap: 4 }}>
                  <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 14.5, color: theme.ink }}>
                    {dayName(on)}
                  </Text>
                  {items.map((item, i) => (
                    <Body key={i} small style={{ color: theme.inkSoft }}>
                      {item.clock ? `${item.clock} · ` : ""}
                      {item.title} · {item.duration} min
                    </Body>
                  ))}
                </View>
              ))}
              <Body small>
                These are saved on their days. Tasks with a time stay fixed; the
                rest are planned when you plan that day.
              </Body>
            </Card>
          )}
          <Card style={{ padding: 18 }}>
            <ProjectPicker
              label={
                capture.items.length > 1 &&
                new Set(itemProjects).size > 1
                  ? "Is this for a project? · mixed, adjust each below"
                  : "Is this for a project?"
              }
              projects={projects}
              value={
                new Set(itemProjects).size === 1 ? (itemProjects[0] ?? null) : null
              }
              onChange={(projectId) =>
                setItemProjects(capture.items.map(() => projectId))
              }
              disabled={busy}
            />
          </Card>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Button
              title={editing ? "Done adjusting" : "Adjust tasks & hours"}
              icon={editing ? "check" : "tune"}
              variant="secondary"
              compact
              onPress={() => setEditing((v) => !v)}
              disabled={busy}
            />
            {!!waiting.length && (
              <Button
                disabled={busy}
                variant={includeWaiting ? "primary" : "secondary"}
                icon={includeWaiting ? "checkCircle" : "add"}
                compact
                title={`${includeWaiting ? "Including" : "Include"} ${waiting.length} waiting`}
                onPress={() => setIncludeWaiting((v) => !v)}
              />
            )}
          </View>
          {editing && (
            <Reveal style={{ gap: 12 }}>
              <Card style={{ padding: 18 }}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Plan date"
                      icon="calendar"
                      placeholder="YYYY-MM-DD"
                      value={day}
                      onChangeText={setDay}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Finish by"
                      icon="moon"
                      placeholder="HH:mm"
                      value={end}
                      onChangeText={setEnd}
                    />
                  </View>
                </View>
                <Body small>
                  Times use {preferences.timezone}. Flexible work starts from
                  now for today, or 08:00 for a future day.
                </Body>
              </Card>
              <Text style={[styles.badge, { color: theme.muted, marginLeft: 6 }]}>
                {capture.items.length} THINGS TO DO · TAP TO EDIT
              </Text>
              {capture.items.map((item, i) => (
                <Card
                  key={`${captureId}-${i}`}
                  style={{ padding: 18, gap: 12 }}
                >
                  <Field
                    label={`Task ${i + 1}`}
                    icon="list"
                    value={item.title}
                    onChangeText={(title) => update(i, { title })}
                  />
                  <Field
                    label="Note"
                    value={item.note || ""}
                    multiline
                    placeholder="Why it matters or how to do it"
                    onChangeText={(note) => update(i, { note: note || undefined })}
                  />
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Minutes"
                        icon="timer"
                        value={String(item.duration || "")}
                        numeric
                        onChangeText={(v) => update(i, { duration: Number(v) })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Fixed time"
                        icon="clock"
                        placeholder="Optional"
                        value={item.clock || ""}
                        onChangeText={(clock) =>
                          update(i, { clock: clock || null })
                        }
                      />
                    </View>
                  </View>
                  <Field
                    label={`Day YYYY-MM-DD (empty = ${day})`}
                    icon="calendar"
                    value={item.day || ""}
                    onChangeText={(on) => update(i, { day: on || undefined })}
                  />
                  <Field label="Deadline YYYY-MM-DD (optional)" value={item.dueDay || ""} onChangeText={dueDay => update(i, { dueDay: dueDay || undefined })} />
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {(["low", "normal", "high"] as const).map(priority => <Button key={priority} title={`${priority} priority`} compact variant={(item.priority || "normal") === priority ? "accent" : "secondary"} onPress={() => update(i, { priority })} />)}
                  </View>
                  {item.project && !projects.some(p => p.title.toLowerCase() === item.project!.toLowerCase()) && <Body small>Project “{item.project}” isn’t in your list yet. Choose or create it below.</Body>}
                  {item.steps.length > 0 && (
                    <Body small>{item.steps.join(" → ")}</Body>
                  )}
                  <ProjectPicker
                    projects={projects}
                    value={itemProjects[i] ?? null}
                    onChange={(projectId) =>
                      setItemProjects((list) =>
                        capture.items.map((_, n) =>
                          n === i ? projectId : (list[n] ?? null),
                        ),
                      )
                    }
                    disabled={busy}
                  />
                  <Button
                    title="Remove from this plan"
                    icon="delete"
                    variant="danger"
                    compact
                    style={{ alignSelf: "flex-start" }}
                    onPress={() => {
                      setItemProjects((list) => list.filter((_, n) => n !== i));
                      setCapture((c) =>
                        c
                          ? { ...c, items: c.items.filter((_, n) => n !== i) }
                          : c,
                      );
                    }}
                    disabled={busy}
                  />
                </Card>
              ))}
            </Reveal>
          )}
          {!!preview?.error && <Notice tone="danger">{preview.error}</Notice>}
          <Button
            title={busy ? "Saving your day…" : "Save my plan"}
            variant="accent"
            icon={busy ? undefined : "checkCircle"}
            trailingIcon={busy ? undefined : "arrow"}
            disabled={
              busy ||
              !capture.items.length ||
              !preview?.plan ||
              !!preview.plan.warnings.length
            }
            onPress={async () => {
              if (lock.current || !preview?.plan) return;
              lock.current = true;
              setBusy(true);
              setError("");
              try {
                // Recompute against the latest store and clock before the atomic write.
                let index = 0;
                const added = withProjects(
                  captureTasks(
                    capture.items,
                    day,
                    preferences.timezone,
                    () => `${captureId}-${index++}`,
                  ),
                  itemProjects,
                  useTempo.getState().projects,
                );
                const current = useTempo.getState();
                const existing = current.tasks.map((t) =>
                  includeWaiting && t.status === "pending" && !t.scheduledAt
                    ? { ...t, plannedDay: day, fixed: false }
                    : t,
                );
                const plan = buildDay(
                  [
                    ...existing,
                    ...added,
                    ...sharedPlanTasks(current.shares.incoming),
                  ],
                  current.routines,
                  day,
                  preferences.timezone,
                  new Date(),
                  end,
                );
                if (plan.warnings.length)
                  throw new Error(plan.warnings.join(" "));
                const changes = plan.tasks.filter(
                  (t) =>
                    !isSharedId(t.id) &&
                    !current.tasks.some(
                      (old) =>
                        old.id === t.id &&
                        JSON.stringify(old) === JSON.stringify(t),
                    ),
                );
                await savePlan(changes, end);
                setDraft("");
                setCapture(null);
                router.navigate({ pathname: "/", params: { date: day } });
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not save your plan. Try again.",
                );
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          />
          {preview?.plan && (
            <>
              <View style={{ gap: 4, marginTop: 10 }}>
                <Heading>Your day, broken down</Heading>
                <Body small>
                  {scheduledCount} tasks scheduled ·{" "}
                  {preview.plan.overflow.length} waiting for space · finish by{" "}
                  {end}
                </Body>
              </View>
              <DayTimeline
                blocks={preview.plan.blocks}
                timezone={preferences.timezone}
              />
              {preview.plan.warnings.map((warning, i) => (
                <Notice key={i} tone="danger">
                  {warning}
                </Notice>
              ))}
              {!!preview.plan.overflow.length && (
                <Card
                  style={{ backgroundColor: theme.accentSoft, borderColor: "transparent" }}
                >
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Icon name="history" size={19} color={theme.accentDeep} />
                    <Heading small>Let’s keep this realistic.</Heading>
                  </View>
                  <Body>
                    These won’t fit before {end}. They’ll stay in your waiting
                    list:
                  </Body>
                  {preview.plan.overflow.map((t) => (
                    <View
                      key={t.id}
                      style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: theme.accent,
                        }}
                      />
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: theme.fonts.semibold,
                          fontSize: 14.5,
                          color: theme.ink,
                        }}
                      >
                        {t.title}
                      </Text>
                      <Text
                        style={{
                          fontFamily: theme.fonts.medium,
                          fontSize: 12.5,
                          color: theme.muted,
                        }}
                      >
                        {t.duration} min
                      </Text>
                    </View>
                  ))}
                </Card>
              )}
            </>
          )}
          <Button
            title="Back to my words"
            icon="back"
            variant="ghost"
            disabled={busy}
            onPress={() => setCapture(null)}
          />
        </>
      )}
      {!!error && <Notice tone="danger">{error}</Notice>}
    </View>
  );
}

function DarkStat({
  value,
  label,
  divider = false,
}: {
  value: string;
  label: string;
  divider?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 2,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: theme.darkLine,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.display,
          fontSize: 28,
          lineHeight: 32,
          color: theme.surface,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.semibold,
          fontSize: 11.5,
          color: theme.darkMuted,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
