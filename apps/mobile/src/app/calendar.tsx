import { useEffect, useState } from "react";
import { Platform, Share } from "react-native";
import {
  Screen,
  Card,
  Heading,
  Body,
  Action,
  Button,
  Notice,
} from "../components/ui";
import { useTempo } from "../data/store";
import {
  calendarSupported,
  connectCalendars,
  readCalendar,
  exportCalendarTask,
  type DeviceCalendar,
  type CalendarItem,
} from "../lib/calendar";
import {
  calendarTasks,
  calendarText,
} from "../../../../packages/core/src/calendar";
import {
  localInstant,
  localParts,
} from "../../../../packages/core/src/scheduling";
import { shiftDay } from "../../../../packages/core/src/day-lifecycle";
export default function CalendarScreen() {
  const { tasks, preferences } = useTempo();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]),
    [chosen, setChosen] = useState<DeviceCalendar | null>(null),
    [events, setEvents] = useState<CalendarItem[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [message, setMessage] = useState("");
  const today = localParts(new Date(), preferences.timezone).date;
  const upcoming = tasks.filter(
    (t) =>
      t.status === "pending" &&
      t.scheduledAt &&
      Date.parse(t.scheduledAt) >= now &&
      Date.parse(t.scheduledAt) < now + 7 * 86400000,
  );
  return (
    <Screen
      title="Room around real life."
      eyebrow="CALENDAR"
      subtitle="Import selected appointments as fixed tasks, or send scheduled work to your calendar."
    >
      <Card>
        <Body>
          Only the appointments you select are saved to your Tempo account.
          All-day events and events longer than 24 hours are omitted. Import is
          a snapshot; calendar edits require review in Tempo.
        </Body>
        {calendarSupported ? (
          <Action
            title="Connect device calendars"
            run={async () => setCalendars(await connectCalendars())}
          />
        ) : (
          <Body>
            Device calendar access works in a rebuilt iOS or Android app. You
            can download your next seven days below.
          </Body>
        )}
        {calendars.map((c) => (
          <Action
            key={c.id}
            title={c.title}
            variant="secondary"
            run={async () => {
              const items = await readCalendar(
                c.id,
                localInstant(today, "00:00", preferences.timezone),
                localInstant(shiftDay(today, 7), "00:00", preferences.timezone),
              );
              setChosen(c);
              setEvents(items);
              setSelected([]);
              setMessage("");
            }}
          />
        ))}
      </Card>
      {chosen && (
        <Card>
          <Heading small>{chosen.title} · next 7 days</Heading>
          {events.map((e) => (
            <Button
              key={e.id}
              title={`${selected.includes(e.id) ? "✓ " : ""}${localParts(new Date(e.start), preferences.timezone).date} ${localParts(new Date(e.start), preferences.timezone).clock} · ${e.title}`}
              compact
              variant={selected.includes(e.id) ? "accent" : "secondary"}
              onPress={() =>
                setSelected((ids) =>
                  ids.includes(e.id)
                    ? ids.filter((id) => id !== e.id)
                    : [...ids, e.id],
                )
              }
            />
          ))}
          {!events.length && (
            <Body>No timed events in this calendar for the coming week.</Body>
          )}
          <Action
            title={`Import ${selected.length} selected appointments`}
            run={async () => {
              if (!selected.length)
                throw new Error("Select appointments first.");
              const current = useTempo.getState();
              const added = calendarTasks(
                events.filter((e) => selected.includes(e.id)),
                current.tasks,
                current.preferences.timezone,
              );
              if (added.length) await current.saveTasks(added);
              setSelected([]);
              setMessage(
                `${added.length} appointments added. Previously imported events were skipped.`,
              );
            }}
          />
          {chosen.writable &&
            upcoming.map((t) => (
              <Action
                key={t.id}
                title={`Add to calendar: ${t.title}`}
                compact
                variant="secondary"
                run={async () => {
                  await exportCalendarTask(chosen.id, t);
                }}
              />
            ))}
        </Card>
      )}
      <Action
        title={
          Platform.OS === "web"
            ? "Export next 7 days (.ics)"
            : "Share next 7 days as calendar text"
        }
        variant="secondary"
        run={async () => {
          const text = calendarText(upcoming);
          if (Platform.OS === "web") {
            const url = URL.createObjectURL(
              new Blob([text], { type: "text/calendar;charset=utf-8" }),
            );
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "tempo-week.ics";
            anchor.click();
            URL.revokeObjectURL(url);
          } else await Share.share({ message: text, title: "Tempo week" });
        }}
      />
      {!!message && <Notice tone="mint">{message}</Notice>}
    </Screen>
  );
}
