import { Text, View } from "react-native";
import { Card, Body, Heading, Label, theme } from "./ui";
import { localParts } from "../../../../packages/core/src/scheduling";
import type { DayBlock } from "../../../../packages/core/src/day-planner";
export function DayTimeline({
  blocks,
  timezone,
}: {
  blocks: DayBlock[];
  timezone: string;
}) {
  return (
    <View style={{ gap: 10 }}>
      {blocks.map((block) => {
        const done = block.task?.status === "completed";
        const end = new Date(Date.parse(block.start) + block.duration * 60000);
        return (
          <Card
            key={block.id}
            style={{
              padding: block.kind === "break" ? 14 : 18,
              backgroundColor:
                block.kind === "break" ? "transparent" : theme.surface,
              flexDirection: "row",
              gap: 15,
              opacity: done ? 0.6 : 1,
            }}
          >
            <View style={{ width: 55, gap: 5 }}>
              <Label>{localParts(new Date(block.start), timezone).clock}</Label>
              <Body small>{localParts(end, timezone).clock}</Body>
            </View>
            <View
              style={{
                flex: 1,
                gap: 6,
                borderLeftWidth: 2,
                borderLeftColor:
                  block.kind === "routine"
                    ? theme.mint
                    : block.kind === "break"
                      ? theme.line
                      : theme.accent,
                paddingLeft: 14,
              }}
            >
              <Heading small>
                {done ? "✓ " : ""}
                {block.title}
              </Heading>
              <Body small>
                {block.duration} min
                {block.kind === "routine"
                  ? " · protected routine"
                  : block.task?.fixed !== false && block.kind === "task"
                    ? " · fixed time"
                    : block.kind === "break"
                      ? " · stretch, water, reset"
                      : ""}
              </Body>
              {block.task?.steps?.map((step, i) => (
                <Text
                  key={i}
                  style={{
                    fontFamily: theme.fonts.regular,
                    color: theme.muted,
                    lineHeight: 21,
                    fontSize: 13,
                  }}
                >
                  {i + 1}. {step}
                </Text>
              ))}
            </View>
          </Card>
        );
      })}
    </View>
  );
}
