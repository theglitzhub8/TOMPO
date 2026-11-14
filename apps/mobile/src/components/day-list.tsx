import { Text, View } from "react-native";
import { router } from "expo-router";
import { Icon, Tap, theme } from "./ui";
import { useTempo, isSharedId, shareForId } from "../data/store";
import { localParts } from "../../../../packages/core/src/scheduling";
import type { DayBlock } from "../../../../packages/core/src/day-planner";

/** The day as a checklist: tap the circle to finish a task. */
export function DayList({ blocks, timezone, now }: { blocks: DayBlock[]; timezone: string; now: number }) {
  const incoming = useTempo((s) => s.shares.incoming);
  const rows = blocks.filter((b) => b.kind !== "break");
  if (!rows.length) return null;
  return (
    <View
      style={{
        borderRadius: 24,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.line,
        paddingHorizontal: 16,
      }}
    >
      {rows.map((block, i) => {
        const task = block.task;
        const done = task?.status === "completed";
        const start = Date.parse(block.start);
        const current = !done && start <= now && now < start + block.duration * 60000;
        const shared = isSharedId(block.id) ? shareForId(incoming, block.id) : undefined;
        const toggle = async () => {
          if (!task || shared) return;
          const state = useTempo.getState();
          const live = state.tasks.find((t) => t.id === task.id);
          if (!live) return;
          await state.save("task", {
            ...live,
            status: done ? "pending" : "completed",
            completedAt: done ? null : new Date().toISOString(),
            startedAt: null,
          });
        };
        return (
          <View
            key={block.id}
            style={{
              flexDirection: "row",
              gap: 12,
              paddingVertical: 14,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: theme.line,
              alignItems: "flex-start",
            }}
          >
            <Text
              style={{
                width: 44,
                paddingTop: 2,
                fontFamily: theme.fonts.bold,
                fontSize: 12.5,
                color: current ? theme.accent : theme.muted,
                fontVariant: ["tabular-nums"],
              }}
            >
              {localParts(new Date(start), timezone).clock}
            </Text>
            <Tap
              accessibilityRole="button"
              accessibilityLabel={task ? `Edit ${block.title}` : block.title}
              disabled={!task || !!shared}
              onPress={() => router.navigate({ pathname: "/tasks", params: { edit: block.id } })}
              scale={0.99}
              style={{ flex: 1, gap: 3 }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.bold,
                  fontSize: 15.5,
                  lineHeight: 21,
                  color: done ? theme.muted : theme.ink,
                  textDecorationLine: done ? "line-through" : "none",
                }}
              >
                {block.title}
                {block.kind === "routine" && <Text style={{ fontFamily: theme.fonts.bold, fontSize: 11, color: theme.accent }}>{"  "}WEEKLY</Text>}
              </Text>
              {!!task?.note && !done && (
                <Text style={{ fontFamily: theme.fonts.regular, fontSize: 13, lineHeight: 18, color: theme.muted }}>
                  {task.note}
                </Text>
              )}
              <Text style={{ fontFamily: theme.fonts.medium, fontSize: 12, color: theme.faint }}>
                {block.duration} min
                {shared ? ` · with ${shared.ownerName.split(/\s+/)[0]}` : ""}
                {current ? " · now" : ""}
              </Text>
            </Tap>
            {task && !shared ? (
              <Tap
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={done ? `Mark ${block.title} not done` : `Finish ${block.title}`}
                hitSlop={10}
                onPress={() => void toggle().catch(() => undefined)}
                scale={0.85}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: done ? theme.progress : current ? theme.accent : theme.lineStrong,
                  backgroundColor: done ? theme.progress : "transparent",
                }}
              >
                {done && <Icon name="check" size={17} color={theme.surface} />}
              </Tap>
            ) : (
              <View style={{ width: 28 }} />
            )}
          </View>
        );
      })}
    </View>
  );
}
