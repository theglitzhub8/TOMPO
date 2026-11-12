import { useState } from "react";
import { View } from "react-native";
import {
  Screen,
  Card,
  Body,
  Button,
  Action,
  Heading,
  Field,
  Notice,
} from "../components/ui";
import { useTempo, sharedPlanTasks, isSharedId } from "../data/store";
import {
  buildWeek,
  type BusyBlock,
} from "../../../../packages/core/src/week-planner";
import { localParts } from "../../../../packages/core/src/scheduling";
import { shiftDay } from "../../../../packages/core/src/day-lifecycle";
export default function Week() {
  const { tasks, preferences, revision } = useTempo();
  const today = localParts(new Date(), preferences.timezone).date;
  const [day, setDay] = useState(today),
    [end, setEnd] = useState(preferences.dayEnd || "21:00");
  const candidates = tasks.filter(
    (t) => t.status === "pending" && t.fixed === false,
  );
  const [selected, setSelected] = useState<string[]>(() =>
    candidates
      .filter((t) => !t.plannedDay || t.plannedDay <= shiftDay(today, 6))
      .map((t) => t.id),
  );
  const [preview, setPreview] = useState<ReturnType<typeof buildWeek> | null>(
    null,
  );
  const [reviewed, setReviewed] = useState(0),
    [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  return (
    <Screen
      title="A realistic week."
      eyebrow="LOOK AHEAD"
      subtitle="Choose the work to fit around your appointments and routines. Deadlines come first; shared project work respects teammates’ saved busy times."
    >
      <Card>
        <Field
          label="Week starts YYYY-MM-DD"
          value={day}
          onChangeText={(v) => {
            setDay(v);
            setPreview(null);
          }}
        />
        <Field
          label="Finish each day by HH:mm"
          value={end}
          onChangeText={(v) => {
            setEnd(v);
            setPreview(null);
          }}
        />
        <Body>
          {selected.filter((id) => candidates.some((t) => t.id === id)).length}{" "}
          selected
        </Body>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            title="Select all"
            compact
            variant="secondary"
            onPress={() => {
              setSelected(candidates.map((t) => t.id));
              setPreview(null);
            }}
          />
          <Button
            title="Clear"
            compact
            variant="ghost"
            onPress={() => {
              setSelected([]);
              setPreview(null);
            }}
          />
        </View>
        {candidates.map((t) => (
          <Button
            key={t.id}
            title={`${selected.includes(t.id) ? "✓ " : ""}${t.title}${t.dueDay ? ` · due ${t.dueDay}` : ""}`}
            compact
            variant={selected.includes(t.id) ? "accent" : "secondary"}
            onPress={() => {
              setSelected((ids) =>
                ids.includes(t.id)
                  ? ids.filter((id) => id !== t.id)
                  : [...ids, t.id],
              );
              setPreview(null);
            }}
          />
        ))}
        {!candidates.length && (
          <Body>
            No flexible work waiting. Add tasks or capture a plan first.
          </Body>
        )}
        <Action
          title="Preview week"
          variant="secondary"
          run={async () => {
            if (day < today) throw new Error("Choose today or a future date.");
            if (!selected.length) throw new Error("Choose at least one task.");
            const current = useTempo.getState();
            const { busy } = await current.cloudRequest<{ busy: BusyBlock[] }>(
              "/v1/team/planning",
            );
            const plan = buildWeek(
              [...current.tasks, ...sharedPlanTasks(current.shares.incoming)],
              current.routines,
              selected,
              day,
              current.preferences.timezone,
              new Date(),
              end,
              busy,
            );
            setPreview(plan);
            setReviewed(current.revision);
            setBusyKey(JSON.stringify(busy));
            setMessage("");
          }}
        />
      </Card>
      {preview && (
        <>
          {preview.days.map((d) => (
            <Card key={d.date}>
              <Heading small>
                {d.date} · {d.tasks.length} tasks
              </Heading>
              {d.tasks.map((t) => (
                <Body small key={t.id}>
                  {
                    localParts(new Date(t.scheduledAt!), preferences.timezone)
                      .clock
                  }{" "}
                  · {t.title} · {t.duration} min
                </Body>
              ))}
              {!d.tasks.length && <Body small>Room to breathe.</Body>}
            </Card>
          ))}
          {preview.warnings.map((w, i) => (
            <Notice key={i} tone="danger">
              {w}
            </Notice>
          ))}
          {revision !== reviewed && (
            <Notice tone="danger">
              Your tasks changed. Preview again before saving.
            </Notice>
          )}
          {revision === reviewed && (
            <Action
              title="Save this week"
              run={async () => {
                const current = useTempo.getState();
                const { busy } = await current.cloudRequest<{
                  busy: BusyBlock[];
                }>("/v1/team/planning");
                const fresh = buildWeek(
                  [
                    ...current.tasks,
                    ...sharedPlanTasks(current.shares.incoming),
                  ],
                  current.routines,
                  selected,
                  day,
                  current.preferences.timezone,
                  new Date(),
                  end,
                  busy,
                );
                if (
                  JSON.stringify(busy) !== busyKey ||
                  JSON.stringify(fresh.tasks) !== JSON.stringify(preview.tasks)
                ) {
                  setPreview(fresh);
                  setReviewed(current.revision);
                  setBusyKey(JSON.stringify(busy));
                  throw new Error(
                    "Availability changed. Review this updated week, then save again.",
                  );
                }
                const changed = preview.tasks.filter(
                  (t) =>
                    !isSharedId(t.id) &&
                    selected.includes(t.id) &&
                    current.tasks.some(
                      (old) =>
                        old.id === t.id &&
                        JSON.stringify(old) !== JSON.stringify(t),
                    ),
                );
                await current.saveReviewedPlan(changed, end, reviewed);
                setPreview(null);
                setMessage(
                  "Your week is saved. Open Today to follow each day’s plan.",
                );
              }}
            />
          )}
        </>
      )}
      {!!message && <Notice tone="mint">{message}</Notice>}
    </Screen>
  );
}
