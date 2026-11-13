import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as session from "./session";
import {
  rememberPushToken,
  useTempo,
  sharedPlanTasks,
  shareForId,
  type IncomingShare,
  type Preferences,
  type Task,
} from "../data/store";
import { planReminders, type Reminder } from "../../../../packages/core/src/reminders";

export type ReminderStatus = "on" | "off" | "denied" | "undetermined" | "unsupported";
type ReminderData = {
  tempo: true;
  taskId: string;
  kind: Reminder["kind"];
  snooze?: boolean;
  share?: { ownerId: string; taskId: string };
};

export const remindersSupported = true;
const flagKey = "tempo-reminders";
const channelId = "tasks";
let configured: Promise<void> | undefined;

function configure() {
  configured ??= (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    await Notifications.setNotificationChannelAsync(channelId, {
      name: "Task reminders",
      // eslint-disable-next-line import/namespace -- exported at runtime; the plugin cannot parse the compiled enum
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#E86A4A",
    });
    await Notifications.setNotificationCategoryAsync("tempo-start", [
      { identifier: "start", buttonTitle: "Start" },
      { identifier: "snooze", buttonTitle: "In 10 min" },
      { identifier: "done", buttonTitle: "Already done" },
    ]);
    await Notifications.setNotificationCategoryAsync("tempo-end", [
      { identifier: "done", buttonTitle: "Yes, done" },
      { identifier: "extend", buttonTitle: "15 more min" },
    ]);
  })();
  return configured;
}

export async function getReminderStatus(): Promise<ReminderStatus> {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    return permission.canAskAgain ? "undetermined" : "denied";
  return (await session.getItemAsync(flagKey)) === "off" ? "off" : "on";
}

export async function enableReminders(): Promise<ReminderStatus> {
  await configure();
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return "denied";
  await session.setItemAsync(flagKey, "on");
  await syncReminders();
  void registerPush().catch(() => undefined);
  return "on";
}

/**
 * Lets teammates' updates reach this phone even when Tempo is closed.
 * Needs the app linked to an EAS project (expo.extra.eas.projectId).
 */
export async function registerPush(): Promise<"registered" | "unavailable"> {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const permission = await Notifications.getPermissionsAsync();
  if (!projectId || !permission.granted || !useTempo.getState().user) return "unavailable";
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await useTempo.getState().cloudRequest("/v1/push/register", {
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
  });
  rememberPushToken(token);
  return "registered";
}

export async function disableReminders() {
  await session.setItemAsync(flagKey, "off");
  await cancelTempo(() => true);
}

async function cancelTempo(match: (data: ReminderData) => boolean) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => {
        const data = n.content.data as ReminderData | undefined;
        return data?.tempo && match(data);
      })
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

function reminderTasks(tasks: Task[], incoming: IncomingShare[]) {
  return [
    ...tasks,
    ...sharedPlanTasks(incoming).map((t) => ({
      ...t,
      with: shareForId(incoming, t.id)?.ownerName.split(/\s+/)[0],
    })),
  ];
}

async function schedule(reminder: Reminder, data: ReminderData, identifier = reminder.id) {
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: reminder.title,
      body: reminder.body,
      sound: true,
      categoryIdentifier: reminder.kind === "end" ? "tempo-end" : "tempo-start",
      data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminder.at,
      channelId,
    },
  });
}

let syncing: Promise<void> = Promise.resolve();
/** Make the phone's scheduled reminders match the current plan. */
export function syncReminders() {
  const run = syncing.then(async () => {
    if ((await getReminderStatus()) !== "on") return;
    await configure();
    const { tasks, shares, preferences } = useTempo.getState();
    await apply(tasks, shares.incoming, preferences);
  });
  syncing = run.catch(() => undefined);
  return run;
}

async function apply(tasks: Task[], incoming: IncomingShare[], preferences: Preferences) {
  const all = reminderTasks(tasks, incoming);
  const desired = planReminders(all, preferences, new Date());
  const wanted = new Map(desired.map((r) => [r.id, r]));
  const pending = new Set(all.filter((t) => t.status === "pending").map((t) => t.id));
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const kept = new Set<string>();
  for (const n of scheduled) {
    const data = n.content.data as ReminderData | undefined;
    if (!data?.tempo) continue;
    const want = wanted.get(n.identifier);
    const keep = data.snooze
      ? pending.has(data.taskId)
      : !!want && want.title === n.content.title && want.body === n.content.body;
    if (keep) kept.add(n.identifier);
    else await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  for (const r of desired) {
    if (kept.has(r.id)) continue;
    const share = shareForId(incoming, r.taskId);
    await schedule(r, {
      tempo: true,
      taskId: r.taskId,
      kind: r.kind,
      ...(share ? { share: { ownerId: share.ownerId, taskId: share.taskId } } : {}),
    });
  }
}

/** Fires a sample reminder in a few seconds so people can see how it looks. */
export async function sendTestReminder() {
  await configure();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "It’s time: Your next task",
      body: "This is how Tempo reminds you. Tap Start, snooze it, or mark it done.",
      sound: true,
      categoryIdentifier: "tempo-start",
      data: { tempoTest: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId,
    },
  });
}

const handled = new Set<string>();
async function respond(response: Notifications.NotificationResponse) {
  const request = response.notification.request;
  const data = request.content.data as ReminderData | undefined;
  const key = `${request.identifier}:${response.actionIdentifier}:${response.notification.date}`;
  if (handled.has(key)) return;
  handled.add(key);
  if ((request.content.data as { tempoPush?: boolean } | undefined)?.tempoPush) {
    // A teammate changed something: pull it in, then show Today.
    router.navigate("/");
    await useTempo.getState().sync();
    return;
  }
  if (!data?.tempo) {
    router.navigate("/");
    return;
  }
  const state = useTempo.getState();
  const task = reminderTasks(state.tasks, state.shares.incoming).find(
    (t) => t.id === data.taskId,
  );
  switch (response.actionIdentifier) {
    case "done":
      if (data.share) await state.setSharedDone(data.share.ownerId, data.share.taskId, true);
      else if (task && task.status === "pending")
        await state.save("task", {
          ...task,
          status: "completed",
          completedAt: new Date().toISOString(),
        });
      await Notifications.dismissNotificationAsync(request.identifier);
      return;
    case "snooze":
    case "extend": {
      if (!task) return;
      const minutes = response.actionIdentifier === "snooze" ? 10 : 15;
      const at = new Date(Date.now() + minutes * 60000);
      const reminder: Reminder = {
        id: `${task.id}:${response.actionIdentifier}:${at.getTime()}`,
        taskId: task.id,
        kind: response.actionIdentifier === "snooze" ? "start" : "end",
        at,
        title: response.actionIdentifier === "snooze" ? `Ready now? ${task.title}` : `Done with ${task.title}?`,
        body:
          response.actionIdentifier === "snooze"
            ? "You snoozed this 10 minutes ago. Start it now, or mark it done."
            : "Your extra 15 minutes are up. Mark it done, or take a little more time.",
      };
      await schedule(reminder, { ...data, kind: reminder.kind, snooze: true }, reminder.id);
      await Notifications.dismissNotificationAsync(request.identifier);
      return;
    }
    case "start":
      if (!data.share) {
        router.navigate({ pathname: "/tasks", params: { focus: data.taskId } });
        return;
      }
      router.navigate("/");
      return;
    default:
      router.navigate("/");
  }
}

/** Keeps reminders in step with the plan and handles taps on notification buttons. */
export function useReminders() {
  const tasks = useTempo((s) => s.tasks);
  const incoming = useTempo((s) => s.shares.incoming);
  const preferences = useTempo((s) => s.preferences);
  useEffect(() => {
    const timer = setTimeout(() => void syncReminders().catch(() => undefined), 800);
    return () => clearTimeout(timer);
  }, [tasks, incoming, preferences]);
  useEffect(() => {
    void configure().catch(() => undefined);
    const last = Notifications.getLastNotificationResponse();
    if (last) void respond(last).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener((r) => {
      void respond(r).catch(() => undefined);
    });
    // Arriving while Tempo is open: refresh straight away.
    const received = Notifications.addNotificationReceivedListener((n) => {
      if ((n.request.content.data as { tempoPush?: boolean } | undefined)?.tempoPush)
        void useTempo.getState().sync().catch(() => undefined);
    });
    void getReminderStatus()
      .then((status) => {
        if (status === "on") return registerPush();
      })
      .catch(() => undefined);
    return () => {
      subscription.remove();
      received.remove();
    };
  }, []);
}
