import { useEffect, useState } from "react";
import { View } from "react-native";
import { Action, Body, Button, Card, Field, Heading } from "./ui";
import { buildDay } from "../../../../packages/core/src/day-planner";
import { localParts } from "../../../../packages/core/src/scheduling";
import { useTempo, sharedPlanTasks, type Task } from "../data/store";
export function NextStepActions({ task }: { task: Task }) {
  const [stuck, setStuck] = useState(false);
  const [step, setStep] = useState(
    task.steps?.[0] ||
      `Spend two minutes getting ready for: ${task.title}`.slice(0, 200),
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const run = async (change: Partial<Task>) => {
    const current = useTempo.getState();
    const live = current.tasks.find((t) => t.id === task.id);
    if (!live) throw new Error("This task changed. Refresh your plan.");
    await current.save("task", { ...live, ...change });
  };
  const elapsed = task.startedAt
    ? Math.max(0, Math.floor((now - Date.parse(task.startedAt)) / 60000))
    : 0;
  return (
    <View style={{ gap: 10 }}>
      {task.startedAt && (
        <Body light>
          Focus started · {elapsed} of {task.duration} planned minutes
        </Body>
      )}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Action
          title={task.startedAt ? "Restart focus" : "Start"}
          compact
          variant="accent"
          run={() => run({ startedAt: new Date().toISOString() })}
        />
        <Action
          title="Done"
          compact
          variant="accent"
          run={() =>
            run({
              status: "completed",
              completedAt: new Date().toISOString(),
              startedAt: null,
            })
          }
        />
        {task.fixed === false && (
          <Action
            title="Snooze 10 min"
            compact
            variant="secondary"
            run={async () => {
              const current = useTempo.getState();
              const live = current.tasks.find((t) => t.id === task.id);
              if (!live || live.status !== "pending" || live.fixed !== false)
                throw new Error("This task changed. Refresh your plan.");
              const available = new Date(Date.now() + 600000);
              const day = localParts(
                available,
                current.preferences.timezone,
              ).date;
              const revised = buildDay(
                [
                  ...current.tasks.filter(
                    (t) => t.id !== task.id && t.scheduledAt,
                  ),
                  ...sharedPlanTasks(current.shares.incoming),
                  {
                    ...live,
                    scheduledAt: null,
                    plannedDay: day,
                    startedAt: null,
                  },
                ],
                current.routines,
                day,
                current.preferences.timezone,
                available,
                current.preferences.dayEnd || "21:00",
              );
              const updated = revised.tasks.find((t) => t.id === task.id)!;
              if (!updated.scheduledAt)
                throw new Error(
                  "There’s no room to snooze before your finish time. Use My day changed or carry it to tomorrow.",
                );
              await current.saveReviewedPlan(
                [updated],
                current.preferences.dayEnd || "21:00",
                current.revision,
              );
            }}
          />
        )}
        <Button
          title="I’m stuck"
          compact
          variant="secondary"
          onPress={() => setStuck(!stuck)}
        />
      </View>
      {stuck && (
        <Card>
          <Heading small>Make the first step smaller.</Heading>
          <Body>
            What could you do in two minutes? Open the document, gather what you
            need, or write one sentence.
          </Body>
          <Field
            label="Your first small step"
            value={step}
            onChangeText={setStep}
          />
          <Action
            title="Save first step and start"
            run={async () => {
              if (!step.trim() || step.length > 200)
                throw new Error("Use a step of 1–200 characters.");
              await run({
                steps: [
                  step.trim(),
                  ...(task.steps || []).filter((s) => s !== step.trim()),
                ].slice(0, 8),
                startedAt: new Date().toISOString(),
              });
              setStuck(false);
            }}
          />
        </Card>
      )}
    </View>
  );
}
