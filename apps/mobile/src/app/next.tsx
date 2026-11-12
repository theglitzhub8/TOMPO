import { useEffect, useState } from "react";
import { Screen, Card, Heading, Body, Action, Notice } from "../components/ui";
import { NextStepActions } from "../components/next-step";
import { useTempo } from "../data/store";
import {
  widgetsSupported,
  enableWidgets,
  disableWidgets,
} from "../lib/widgets";
import { localParts } from "../../../../packages/core/src/scheduling";
export default function NextTask() {
  const { tasks, preferences } = useTempo();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [message, setMessage] = useState("");
  const day = localParts(new Date(), preferences.timezone).date;
  const next = tasks
    .filter(
      (t) =>
        t.status === "pending" &&
        t.scheduledAt &&
        localParts(new Date(t.scheduledAt), preferences.timezone).date === day,
    )
    .filter(
      (t) =>
        t.fixed === false ||
        Date.parse(t.scheduledAt!) + t.duration * 60000 > now,
    )
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0];
  return (
    <Screen title="One clear next step." eyebrow="FOCUS">
      <Card dark>
        <Heading light serif>
          {next?.title || "You have some breathing room."}
        </Heading>
        {next ? (
          <>
            <Body light>
              {next.duration} minutes ·{" "}
              {
                localParts(new Date(next.scheduledAt!), preferences.timezone)
                  .clock
              }
            </Body>
            <NextStepActions key={next.id} task={next} />
          </>
        ) : (
          <Body light>Plan your day or add something when you’re ready.</Body>
        )}
      </Card>
      <Card>
        <Heading>Home and lock-screen widget</Heading>
        {widgetsSupported ? (
          <>
            <Body>
              Enabling shows your next planned task title outside the app. Add
              the Tempo Next widget from your iPhone’s widget gallery. It
              refreshes when Tempo opens or your plan changes.
            </Body>
            <Action
              title="Enable task titles in widget"
              run={async () => {
                await enableWidgets();
                setMessage(
                  "Widget data is ready. Add Tempo Next to your home or lock screen.",
                );
              }}
            />
            <Action
              title="Hide task titles in widget"
              variant="secondary"
              run={async () => {
                await disableWidgets();
                setMessage("Task titles are hidden in the widget.");
              }}
            />
          </>
        ) : (
          <Body>
            The home and lock-screen widget is available in the rebuilt iOS app.
            This focus view works on every platform.
          </Body>
        )}
        {!!message && <Notice tone="mint">{message}</Notice>}
      </Card>
    </Screen>
  );
}
