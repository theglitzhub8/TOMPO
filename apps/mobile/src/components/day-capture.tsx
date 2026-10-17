import { useMemo, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Card, Body, Button, Field, Heading, Label, theme, styles } from "./ui";
import { VoiceInput } from "./voice-input";
import { DayTimeline } from "./day-timeline";
import { useTempo, id } from "../data/store";
import { understandDay } from "../lib/capture";
import {
  buildDay,
  captureTasks,
  type Capture,
} from "../../../../packages/core/src/day-planner";
import { localParts } from "../../../../packages/core/src/scheduling";

export function DayCapture() {
  const {
    captureText: draft,
    setCaptureText: setDraft,
    tasks,
    routines,
    preferences,
    savePlan,
  } = useTempo();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [end, setEnd] = useState(preferences.dayEnd || "21:00");
  const [day, setDay] = useState(
    localParts(new Date(), preferences.timezone).date,
  );
  const [includeWaiting, setIncludeWaiting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [captureId, setCaptureId] = useState(id);
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
      const added = captureTasks(
        capture.items,
        day,
        preferences.timezone,
        () => `${captureId}-${index++}`,
      );
      const existing = tasks.map((t) =>
        includeWaiting && waiting.some((w) => w.id === t.id)
          ? { ...t, plannedDay: day, fixed: false }
          : t,
      );
      return {
        plan: buildDay(
          [...existing, ...added],
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
  return (
    <View style={{ gap: 20 }}>
      {!capture ? (
        <>
          <Card style={{ gap: 18, borderWidth: 1, borderColor: theme.line }}>
            <Label>LET IT ALL OUT</Label>
            <Heading>What’s on your mind today?</Heading>
            <Body>
              Chores, work, errands, appointments — tell me everything in one
              go. Add times or durations if you know them.
            </Body>
            <VoiceInput
              value={draft}
              onChange={setDraft}
              disabled={busy}
              onListening={setListening}
            />
            <TextInput
              accessibilityLabel="Everything you need to do today"
              value={draft}
              onChangeText={setDraft}
              editable={!busy && !listening}
              placeholder="I need to wash clothes, finish my proposal, buy groceries and call Mum. I have a meeting at 2pm…"
              placeholderTextColor={theme.muted}
              multiline
              maxLength={12000}
              style={[
                styles.input,
                {
                  minHeight: 175,
                  textAlignVertical: "top",
                  lineHeight: 25,
                  backgroundColor: theme.background,
                },
              ]}
            />
            <Button
              title={busy ? "Making room for your day…" : "Make my day plan →"}
              disabled={busy || listening || !draft.trim()}
              onPress={async () => {
                if (lock.current) return;
                lock.current = true;
                setBusy(true);
                setError("");
                try {
                  const captureDay = localParts(new Date(), preferences.timezone).date;
                  setDay(captureDay);
                  const result = await understandDay(
                    draft,
                    captureDay,
                    preferences.timezone,
                  );
                  setCaptureId(id());
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
          <Body small>
            You don’t need to organize anything first. Tempo will turn your
            words into tasks and find time for them.
          </Body>
        </>
      ) : (
        <>
          <Card dark>
            <Label light>
              {capture.source === "ai"
                ? "YOUR WORDS, ORGANIZED"
                : "QUICK LOCAL PLAN"}
            </Label>
            <Heading light>Here’s room for your day.</Heading>
            <Body light>
              Change anything that doesn’t look right, then save your plan.
            </Body>
          </Card>
          {capture.notes.map((note, i) => (
            <Body key={i} small>
              {note}
            </Body>
          ))}
          <Button
            title={
              editing
                ? "Close task details"
                : "Adjust tasks, times or planning hours"
            }
            onPress={() => setEditing((v) => !v)}
            disabled={busy}
          />
          {editing && (
            <>
              <Card style={{ padding: 18 }}>
                <Field
                  label="Plan date · YYYY-MM-DD"
                  value={day}
                  onChangeText={setDay}
                />
                <Field
                  label="Finish my day by · HH:mm"
                  value={end}
                  onChangeText={setEnd}
                />
                <Body small>
                  Times use {preferences.timezone}. Flexible work starts from
                  now for today, or 08:00 for a future day.
                </Body>
              </Card>
              <Label>{capture.items.length} THINGS TO DO · TAP TO EDIT</Label>
              {capture.items.map((item, i) => (
                <Card
                  key={`${captureId}-${i}`}
                  style={{ padding: 18, gap: 12 }}
                >
                  <Field
                    label={`Task ${i + 1}`}
                    value={item.title}
                    onChangeText={(title) => update(i, { title })}
                  />
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Minutes"
                        value={String(item.duration || "")}
                        numeric
                        onChangeText={(v) => update(i, { duration: Number(v) })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Fixed time · optional"
                        value={item.clock || ""}
                        onChangeText={(clock) =>
                          update(i, { clock: clock || null })
                        }
                      />
                    </View>
                  </View>
                  {item.steps.length > 0 && (
                    <Body small>{item.steps.join(" → ")}</Body>
                  )}
                  <Button
                    title="Remove from this plan"
                    onPress={() =>
                      setCapture((c) =>
                        c
                          ? { ...c, items: c.items.filter((_, n) => n !== i) }
                          : c,
                      )
                    }
                    disabled={busy}
                  />
                </Card>
              ))}
            </>
          )}
          {!!waiting.length && (
            <Button
              disabled={busy}
              title={`${includeWaiting ? "✓ Including" : "Include"} ${waiting.length} waiting ${waiting.length === 1 ? "task" : "tasks"}`}
              onPress={() => setIncludeWaiting((v) => !v)}
            />
          )}
          {!!preview?.error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {preview.error}
            </Text>
          )}
          <Button
            title={busy ? "Saving your day…" : "Save my plan →"}
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
                const added = captureTasks(
                  capture.items,
                  day,
                  preferences.timezone,
                  () => `${captureId}-${index++}`,
                );
                const current = useTempo.getState();
                const existing = current.tasks.map((t) =>
                  includeWaiting && t.status === "pending" && !t.scheduledAt
                    ? { ...t, plannedDay: day, fixed: false }
                    : t,
                );
                const plan = buildDay(
                  [...existing, ...added],
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
              <Body>
                {preview.plan.blocks.filter((b) => b.kind === "task").length}{" "}
                tasks scheduled · {preview.plan.overflow.length} waiting for
                space · finish by {end}
              </Body>
              <Heading>Your day, broken down</Heading>
              <DayTimeline
                blocks={preview.plan.blocks}
                timezone={preferences.timezone}
              />
              {preview.plan.warnings.map((warning, i) => (
                <Body key={i}>{warning}</Body>
              ))}
              {!!preview.plan.overflow.length && (
                <Card style={{ backgroundColor: theme.accentSoft }}>
                  <Heading small>Let’s keep this realistic.</Heading>
                  <Body>
                    These won’t fit before {end}. They’ll stay in your waiting
                    list:
                  </Body>
                  {preview.plan.overflow.map((t) => (
                    <Body key={t.id}>
                      • {t.title} · {t.duration} min
                    </Body>
                  ))}
                </Card>
              )}
            </>
          )}
          <Button
            title="Back to my words"
            disabled={busy}
            onPress={() => setCapture(null)}
          />
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
