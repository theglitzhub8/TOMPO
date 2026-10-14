import { useState } from "react";
import {
  Screen,
  Card,
  Body,
  Button,
  Heading,
  Label,
} from "../../components/ui";
import { RoutineEditor } from "../../components/routine-editor";
import { useTempo } from "../../data/store";
import { Pressable, Text } from "react-native";
import { theme } from "../../design/tokens";
export default function Health() {
  const { routines } = useTempo();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Screen
      eyebrow="HEALTH & CONSISTENCY"
      title="Your routines"
      subtitle="Your health is a protected commitment."
    >
      <Card dark style={{ minHeight: 146, paddingTop: 26, gap: 18 }}>
        <Label light>PROTECTED RECOVERY</Label>
        <Heading light size={21}>
          Sleep comes first.
        </Heading>
        <Body light>Keep your recovery time protected.</Body>
      </Card>
      {routines.map((r) => (
        <Card key={r.id} style={{ minHeight: 75, paddingVertical: 16, gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${r.title}`}
            onPress={() => setOpen(open === r.id ? null : r.id)}
          >
            <Text
              style={{
                fontFamily: theme.fonts.bold,
                fontSize: 16,
                color: theme.ink,
              }}
            >
              ☾ {r.title} {r.start}
            </Text>
          </Pressable>
          <Body>
            Protected · {r.duration} min ·{" "}
            {r.days.length === 7
              ? "Every day"
              : r.days
                  .map(
                    (d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d],
                  )
                  .join(", ")}
          </Body>
          {open === r.id && <RoutineEditor routine={r} />}
        </Card>
      ))}
      {!routines.length && (
        <Card>
          <Body>
            No routines configured. Add sleep, meals, or exercise to protect
            them during planning.
          </Body>
        </Card>
      )}
      {adding && (
        <Card>
          <RoutineEditor />
        </Card>
      )}
      <Button
        title={adding ? "Close routine editor" : "+ Add routine"}
        onPress={() => setAdding(!adding)}
      />
    </Screen>
  );
}
