import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  Screen,
  Card,
  Body,
  Heading,
  Action,
  Button,
  Notice,
} from "../components/ui";
import { useTempo } from "../data/store";
import { localParts } from "../../../../packages/core/src/scheduling";
import { shiftDay } from "../../../../packages/core/src/day-lifecycle";
type Activity = {
  id: string;
  title: string;
  message: string;
  at: string;
  read: string | null;
  data: {
    type?: string;
    taskId?: string;
    ownerId?: string;
    projectId?: string;
  };
};
export default function Inbox() {
  const { cloudRequest: cloud, tasks, preferences, user } = useTempo();
  const [items, setItems] = useState<Activity[]>([]),
    [error, setError] = useState("");
  const load = async () => {
    const r = await cloud<{ items: Activity[] }>("/v1/inbox");
    setItems(r.items);
    setError("");
  };
  useEffect(() => {
    let live = true;
    cloud<{ items: Activity[] }>("/v1/inbox")
      .then((r) => {
        if (live) setItems(r.items);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [cloud]);
  const today = localParts(new Date(), preferences.timezone).date;
  const due = tasks.filter(
    (t) => t.status === "pending" && t.dueDay && t.dueDay <= shiftDay(today, 3),
  );
  return (
    <Screen
      title="You’re up to date."
      eyebrow="ACTIVITY INBOX"
      subtitle="Invitations, shared work, comments, and deadlines in one place."
    >
      {!!error && <Notice tone="danger">{error}</Notice>}
      <Action title="Refresh inbox" variant="secondary" run={load} />
      <Action
        title="Mark all read"
        variant="ghost"
        run={async () => {
          await cloud("/v1/inbox/read", {});
          await load();
        }}
      />
      <Button
        title="Project invitations and shared work"
        variant="secondary"
        onPress={() => router.navigate("/team")}
      />
      {due.map((t) => (
        <Card key={t.id}>
          <Heading small>{t.title}</Heading>
          <Body>
            Due {t.dueDay}
            {t.dueDay! < today ? " · overdue" : ""}
          </Body>
          <Button
            title="Review task"
            compact
            onPress={() =>
              router.navigate({ pathname: "/tasks", params: { focus: t.id } })
            }
          />
        </Card>
      ))}
      {items.map((item) => (
        <Card key={item.id}>
          <Heading small>
            {item.read ? "" : "● "}
            {item.title}
          </Heading>
          <Body>{item.message}</Body>
          <Body small>{new Date(item.at).toLocaleString()}</Body>
          <Button
            title="Open"
            compact
            variant="secondary"
            onPress={() =>
              item.data.ownerId === user?.id && item.data.taskId
                ? router.navigate({
                    pathname: "/tasks",
                    params: { focus: item.data.taskId },
                  })
                : router.navigate(item.data.projectId ? "/team" : "/")
            }
          />
        </Card>
      ))}
      {!items.length && !due.length && (
        <Card>
          <Body>No updates or approaching deadlines.</Body>
        </Card>
      )}
    </Screen>
  );
}
