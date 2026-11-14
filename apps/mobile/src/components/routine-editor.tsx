import { useState } from "react";
import { Text, View } from "react-native";
import { Field, Action, Tap, theme } from "./ui";
import { useTempo, id, type Routine } from "../data/store";
import { validClock } from "../../../../packages/core/src/model";

// Monday first, the way people think about their week.
export const weekOrder = [1, 2, 3, 4, 5, 6, 0];
const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RoutineEditor({ routine, onDone }: { routine?: Routine; onDone?: () => void }) {
  const save = useTempo((s) => s.save);
  const [title, setTitle] = useState(routine?.title ?? "");
  const [start, setStart] = useState(routine?.start ?? "08:00");
  const [duration, setDuration] = useState(String(routine?.duration ?? 60));
  const [days, setDays] = useState(routine?.days ?? [1, 2, 3, 4, 5]);
  return (
    <View style={{ gap: 12 }}>
      <Field label="What is it?" placeholder="Class, work, gym, church…" value={title} onChangeText={setTitle} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Starts (HH:mm)" icon="clock" value={start} onChangeText={setStart} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Minutes" icon="timer" value={duration} onChangeText={setDuration} numeric />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {weekOrder.map((d) => {
          const on = days.includes(d);
          return (
            <Tap
              key={d}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={names[d]}
              onPress={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: on ? theme.accent : theme.surfaceMuted,
              }}
            >
              <Text style={{ fontFamily: theme.fonts.bold, fontSize: 12.5, color: on ? theme.surface : theme.inkSoft }}>
                {names[d].slice(0, 2)}
              </Text>
            </Tap>
          );
        })}
      </View>
      <Action
        title={routine ? "Save weekly task" : "Add to my week"}
        icon="check"
        run={async () => {
          if (!title.trim()) throw new Error("Give it a name, like Class or Gym.");
          if (!validClock(start)) throw new Error("Use a 24-hour start time like 08:00 or 17:30.");
          if (!days.length) throw new Error("Pick at least one day.");
          await save("routine", {
            ...routine,
            id: routine?.id ?? id(),
            title: title.trim(),
            start,
            duration: Number(duration),
            days,
            protected: true,
          });
          if (!routine) setTitle("");
          onDone?.();
        }}
      />
    </View>
  );
}
