import { useState } from "react";
import { Text, View } from "react-native";
import { Chip, Icon, Reveal, theme } from "./ui";
import { shadow } from "../design/tokens";
import { useTempo, shareForId } from "../data/store";
import { projectColor } from "./project-picker";
import { localParts } from "../../../../packages/core/src/scheduling";
import type { DayBlock } from "../../../../packages/core/src/day-planner";
export function DayTimeline({
  blocks,
  timezone,
  now: viewedAt,
}: {
  blocks: DayBlock[];
  timezone: string;
  now?: number;
}) {
  const [mountedAt] = useState(() => Date.now());
  const projects = useTempo((s) => s.projects);
  const incoming = useTempo((s) => s.shares.incoming);
  const now = viewedAt ?? mountedAt;
  return (
    <View>
      {blocks.map((block, index) => {
        const done = block.task?.status === "completed";
        const startMs = Date.parse(block.start);
        const end = new Date(startMs + block.duration * 60000);
        const current = startMs <= now && now < end.getTime() && !done;
        const last = index === blocks.length - 1;
        const fixed = block.kind === "task" && block.task?.fixed !== false;
        const color =
          block.kind === "routine"
            ? theme.mintDeep
            : block.kind === "break"
              ? theme.faint
              : theme.accent;
        return (
          <Reveal
            key={block.id}
            delay={Math.min(index, 8) * 50}
            style={{ flexDirection: "row", gap: 12 }}
          >
            <View style={{ width: 48, paddingTop: block.kind === "break" ? 12 : 18 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.bold,
                  fontSize: 13,
                  color: current ? theme.accent : theme.ink,
                }}
              >
                {localParts(new Date(block.start), timezone).clock}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.medium,
                  fontSize: 11.5,
                  color: theme.faint,
                  marginTop: 2,
                }}
              >
                {localParts(end, timezone).clock}
              </Text>
            </View>
            <View style={{ width: 16, alignItems: "center" }}>
              <View
                style={{
                  width: 2,
                  height: block.kind === "break" ? 14 : 20,
                  backgroundColor: index === 0 ? "transparent" : theme.lineStrong,
                }}
              />
              <View
                style={{
                  width: current ? 16 : 12,
                  height: current ? 16 : 12,
                  borderRadius: 8,
                  backgroundColor: done ? color : theme.surface,
                  borderWidth: done ? 0 : 3,
                  borderColor: color,
                  alignItems: "center",
                  justifyContent: "center",
                  ...(current
                    ? { boxShadow: "0px 0px 0px 5px rgba(232,106,74,0.18)" }
                    : {}),
                }}
              >
                {done && <Icon name="check" size={9} color={theme.surface} />}
              </View>
              <View
                style={{
                  width: 2,
                  flex: 1,
                  backgroundColor: last ? "transparent" : theme.lineStrong,
                }}
              />
            </View>
            {block.kind === "break" ? (
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 10,
                  marginBottom: 6,
                }}
              >
                <Icon name="coffee" size={16} color={theme.faint} />
                <Text
                  style={{
                    fontFamily: theme.fonts.displayItalic,
                    fontSize: 17,
                    color: theme.muted,
                  }}
                >
                  {block.title}
                </Text>
                <Text
                  style={{
                    fontFamily: theme.fonts.medium,
                    fontSize: 12,
                    color: theme.faint,
                  }}
                >
                  · {block.duration} min · stretch, water, reset
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flex: 1,
                  marginBottom: 10,
                  padding: 16,
                  gap: 8,
                  borderRadius: 20,
                  borderWidth: current ? 1.5 : 1,
                  borderColor: current ? theme.accent : theme.line,
                  backgroundColor:
                    block.kind === "routine" ? theme.mintSoft : theme.surface,
                  opacity: done ? 0.55 : 1,
                  ...(block.kind === "routine" ? {} : shadow.soft),
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: theme.fonts.bold,
                      fontSize: 16,
                      lineHeight: 22,
                      color: theme.ink,
                      letterSpacing: -0.2,
                      textDecorationLine: done ? "line-through" : "none",
                    }}
                  >
                    {block.title}
                  </Text>
                  {current && <Chip tone="accent">Now</Chip>}
                </View>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  <Chip icon="timer" tone={block.kind === "routine" ? "mint" : "neutral"}>
                    {block.duration} min
                  </Chip>
                  {block.kind === "routine" && (
                    <Chip icon="spa" tone="mint">
                      Protected routine
                    </Chip>
                  )}
                  {fixed && <Chip icon="event">Fixed time</Chip>}
                  {(() => {
                    const share = shareForId(incoming, block.id);
                    return share ? (
                      <Chip icon="person" tone="accent">
                        {`With ${share.ownerName.split(/\s+/)[0]}`}
                      </Chip>
                    ) : null;
                  })()}
                  {(() => {
                    const project = projects.find(
                      (p) => p.id === block.task?.projectId,
                    );
                    return project ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          paddingHorizontal: 11,
                          minHeight: 30,
                          borderRadius: 15,
                          backgroundColor: `${projectColor(project.id)}1A`,
                        }}
                      >
                        <Icon name="folder" size={14} color={projectColor(project.id)} />
                        <Text
                          numberOfLines={1}
                          style={{
                            maxWidth: 150,
                            fontFamily: theme.fonts.semibold,
                            fontSize: 12.5,
                            color: projectColor(project.id),
                          }}
                        >
                          {project.title}
                        </Text>
                      </View>
                    ) : null;
                  })()}
                  {done && (
                    <Chip icon="checkCircle" tone="mint">
                      Done
                    </Chip>
                  )}
                </View>
                {!done &&
                  block.task?.steps?.map((step, i) => (
                    <View
                      key={i}
                      style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}
                    >
                      <Text
                        style={{
                          fontFamily: theme.fonts.bold,
                          fontSize: 11.5,
                          color: theme.faint,
                          width: 14,
                          lineHeight: 20,
                        }}
                      >
                        {i + 1}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: theme.fonts.regular,
                          color: theme.inkSoft,
                          lineHeight: 20,
                          fontSize: 13.5,
                        }}
                      >
                        {step}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
          </Reveal>
        );
      })}
    </View>
  );
}
