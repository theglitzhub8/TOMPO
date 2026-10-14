import { useState } from "react";
import { View } from "react-native";
import { Field, Action, Body, Button, styles } from "./ui";
import { useTempo, id, type Routine } from "../data/store";
export function RoutineEditor({ routine }: { routine?: Routine }) {
  const save = useTempo((s) => s.save);
  const [title, setTitle] = useState(routine?.title ?? "");
  const [start, setStart] = useState(routine?.start ?? "12:00");
  const [duration, setDuration] = useState(String(routine?.duration ?? 60));
  const [days, setDays] = useState(routine?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  return (
    <>
      <Field label="Routine name" value={title} onChangeText={setTitle} />
      <Field
        label="Start HH:mm (your configured timezone)"
        value={start}
        onChangeText={setStart}
      />
      <Field
        label="Duration in minutes (may span midnight)"
        value={duration}
        onChangeText={setDuration}
        numeric
      />
      <View style={styles.row}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, i) => (
          <Button
            key={label}
            title={`${days.includes(i) ? "✓ " : ""}${label}`}
            onPress={() =>
              setDays(
                days.includes(i) ? days.filter((d) => d !== i) : [...days, i],
              )
            }
          />
        ))}
      </View>
      <Body>
        Protected: daily planning will work around this time. Only your explicit
        edits change it.
      </Body>
      <Action
        title="Save routine"
        run={async () => {
          await save("routine", {
            id: routine?.id ?? id(),
            title: title.trim(),
            start,
            duration: Number(duration),
            days,
            protected: true,
          });
          if (!routine) setTitle("");
        }}
      />
    </>
  );
}
