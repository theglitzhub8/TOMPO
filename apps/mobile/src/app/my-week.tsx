import { useState } from "react";
import { Text, View } from "react-native";
import { Screen, Card, Body, Button, Action, Icon, Tap, theme } from "../components/ui";
import { RoutineEditor, weekOrder } from "../components/routine-editor";
import { talk } from "../components/helper";
import { useTempo, type Routine } from "../data/store";
import { dayList } from "../lib/assistant";

const colors = [theme.accent, theme.sun, theme.violet, theme.progress, theme.danger, "#0EA5B7"];
const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
const clockOf = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const initials = ["S", "M", "T", "W", "T", "F", "S"];

/** The person's regular week: tasks that repeat every week at the same time. */
export default function MyWeek() {
  const routines = useTempo((s) => s.routines);
  const remove = useTempo((s) => s.remove);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const sorted = [...routines].sort((a, b) => a.start.localeCompare(b.start));
  const color = (r: Routine) => colors[sorted.indexOf(r) % colors.length];
  return (
    <Screen
      eyebrow="MY WEEK"
      title="Your regular week."
      subtitle="These repeat every week. Tempo plans everything else around them and warns you before anything clashes."
    >
      {!!routines.length && <WeekGrid routines={sorted} color={color} onPick={setEditing} />}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          title="Tell Tempo"
          icon="mic"
          variant="accent"
          compact
          style={{ flex: 1 }}
          onPress={() => talk(undefined, "week")}
        />
        <Button
          title="Add by hand"
          icon="add"
          variant="secondary"
          compact
          style={{ flex: 1 }}
          onPress={() => {
            setEditing(null);
            setAdding(!adding);
          }}
        />
      </View>
      {adding && (
        <Card>
          <RoutineEditor onDone={() => setAdding(false)} />
        </Card>
      )}
      {!routines.length && !adding && (
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 30 }}>
          <Icon name="routine" size={34} color={theme.accent} />
          <Text style={{ fontFamily: theme.fonts.display, fontSize: 28, color: theme.ink, textAlign: "center" }}>
            Nothing fixed yet.
          </Text>
          <Body style={{ textAlign: "center", maxWidth: 300 }}>
            Tap Tell Tempo and say something like “Monday and Wednesday I have class from 8 to 10, and gym every Tuesday at 5.”
          </Body>
        </Card>
      )}
      {sorted.map((r) => (
        <Card key={r.id} style={{ gap: 12, padding: 16 }}>
          <Tap
            accessibilityRole="button"
            accessibilityLabel={`Edit ${r.title}`}
            onPress={() => setEditing(editing === r.id ? null : r.id)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <View style={{ width: 10, height: 40, borderRadius: 5, backgroundColor: color(r) }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: theme.fonts.bold, fontSize: 16, color: theme.ink }}>{r.title}</Text>
              <Text style={{ fontFamily: theme.fonts.medium, fontSize: 13, color: theme.muted }}>
                {dayList(r.days)} · {r.start}–{clockOf(minutes(r.start) + r.duration)}
              </Text>
              {!!r.skippedDays?.length && (
                <Text style={{ fontFamily: theme.fonts.medium, fontSize: 12, color: theme.sun }}>
                  Skipped on {r.skippedDays.slice(-3).join(", ")}
                </Text>
              )}
            </View>
            <Icon name={editing === r.id ? "collapse" : "expand"} size={20} color={theme.faint} />
          </Tap>
          {editing === r.id && (
            <>
              <RoutineEditor key={r.id} routine={r} onDone={() => setEditing(null)} />
              <Action title="Remove from my week" icon="delete" variant="danger" compact run={() => remove("routine", r.id)} />
            </>
          )}
        </Card>
      ))}
    </Screen>
  );
}

function WeekGrid({
  routines,
  color,
  onPick,
}: {
  routines: Routine[];
  color: (r: Routine) => string;
  onPick: (id: string) => void;
}) {
  const from = Math.max(0, Math.floor(Math.min(...routines.map((r) => minutes(r.start))) / 60) * 60);
  const to = Math.min(24 * 60, Math.ceil(Math.max(...routines.map((r) => minutes(r.start) + r.duration)) / 60) * 60);
  const span = Math.max(60, to - from);
  const height = 320;
  const hours = Array.from({ length: Math.floor(span / 60) + 1 }, (_, i) => from + i * 60).filter((_, i, all) => all.length <= 9 || i % 2 === 0);
  return (
    <Card style={{ padding: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", paddingLeft: 30 }}>
        {weekOrder.map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: "center", fontFamily: theme.fonts.bold, fontSize: 12, color: theme.muted }}>
            {initials[d]}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", height }}>
        <View style={{ width: 30 }}>
          {hours.map((h) => (
            <Text
              key={h}
              style={{ position: "absolute", top: ((h - from) / span) * height - 6, fontFamily: theme.fonts.semibold, fontSize: 10, color: theme.faint }}
            >
              {clockOf(h).slice(0, 2)}
            </Text>
          ))}
        </View>
        {weekOrder.map((d) => (
          <View key={d} style={{ flex: 1, marginHorizontal: 1.5, borderRadius: 8, backgroundColor: theme.background }}>
            {routines
              .filter((r) => r.days.includes(d))
              .map((r) => {
                const top = ((Math.max(minutes(r.start), from) - from) / span) * height;
                const h = Math.max(14, (Math.min(r.duration, to - minutes(r.start)) / span) * height);
                return (
                  <Tap
                    key={r.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.title} at ${r.start}`}
                    onPress={() => onPick(r.id)}
                    style={{
                      position: "absolute",
                      top,
                      left: 0,
                      right: 0,
                      height: h,
                      borderRadius: 6,
                      backgroundColor: color(r),
                      paddingHorizontal: 2,
                      paddingTop: 2,
                      overflow: "hidden",
                    }}
                  >
                    {h >= 22 && (
                      <Text numberOfLines={2} style={{ fontFamily: theme.fonts.bold, fontSize: 9, lineHeight: 11, color: theme.surface }}>
                        {r.title}
                      </Text>
                    )}
                  </Tap>
                );
              })}
          </View>
        ))}
      </View>
    </Card>
  );
}
