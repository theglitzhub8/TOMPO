import { useEffect } from "react";
import { VStack, Text, Link } from "@expo/ui/swift-ui";
import { createWidget } from "expo-widgets";
import { useTempo } from "../data/store";
import * as session from "./session";
import { localParts } from "../../../../packages/core/src/scheduling";
type Props = { title: string; detail: string };
const NextWidget = createWidget("TempoNext", (props: Props) => {
  "widget";
  return (
    <VStack>
      <Text>TEMPO · PLANNED NEXT</Text>
      <Text>{props.title}</Text>
      <Text>{props.detail}</Text>
      <Link destination="tempo://next">
        <Text>Open Tempo</Text>
      </Link>
    </VStack>
  );
});
export const widgetsSupported = true;
let widgetWrites = Promise.resolve();
function update() {
  const work = widgetWrites.then(async () => {
    const state = useTempo.getState();
    const enabled = state.user
      ? await session.getItemAsync(`tempo-widget-${state.user.id}`)
      : null;
    const today = localParts(new Date(), state.preferences.timezone).date;
    const next =
      state.user && enabled === "on"
        ? state.tasks
            .filter(
              (t) =>
                t.status === "pending" &&
                t.scheduledAt &&
                localParts(new Date(t.scheduledAt), state.preferences.timezone)
                  .date === today,
            )
            .filter(
              (t) =>
                t.fixed === false ||
                Date.parse(t.scheduledAt!) + t.duration * 60000 > Date.now(),
            )
            .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))[0]
        : null;
    const props: Props = next
      ? {
          title: next.title,
          detail: `${localParts(new Date(next.scheduledAt!), state.preferences.timezone).clock} · ${next.duration} min`,
        }
      : {
          title:
            state.user && enabled === "on"
              ? "Room for what’s next."
              : "Open Tempo to see your plan.",
          detail: "One day at a time.",
        };
    NextWidget.updateTimeline([
      { date: new Date(), props },
      {
        date: new Date(Date.now() + 86400000),
        props: {
          title: "Open Tempo to refresh your plan.",
          detail: "One day at a time.",
        },
      },
    ]);
  });
  widgetWrites = work.catch(() => undefined);
  return work;
}
export async function enableWidgets() {
  const user = useTempo.getState().user;
  if (!user) throw new Error("Sign in first.");
  await session.setItemAsync(`tempo-widget-${user.id}`, "on");
  await update();
}
export async function disableWidgets() {
  const user = useTempo.getState().user;
  if (user) await session.deleteItemAsync(`tempo-widget-${user.id}`);
  await update();
}
export function WidgetSync() {
  const revision = useTempo((s) => s.revision),
    user = useTempo((s) => s.user);
  useEffect(() => {
    void update().catch(() => undefined);
  }, [revision, user]);
  return null;
}
