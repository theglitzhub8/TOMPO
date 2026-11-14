import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Action, Icon, Tap, theme } from "./ui";
import { talk } from "./helper";
import { shadow, gradient, gradients } from "../design/tokens";
import { useTempo, type Task } from "../data/store";
import { localParts } from "../../../../packages/core/src/scheduling";

const clockText = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

/** The one thing to do now, with a live countdown. */
export function NowCard({ task, project }: { task: Task; project?: string }) {
  const timezone = useTempo((s) => s.preferences.timezone);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const start = Date.parse(task.scheduledAt!);
  const end = start + task.duration * 60000;
  const started = !!task.startedAt;
  const due = now >= start;
  const late = due && !started;
  const label = !due
    ? "STARTS IN"
    : started
      ? "TIME LEFT"
      : `DUE ${Math.max(1, Math.floor((now - start) / 60000))} MIN AGO`;
  const count = !due ? start - now : started ? Math.max(0, Date.parse(task.startedAt!) + task.duration * 60000 - now) : end - now;
  const save = async (change: Partial<Task>) => {
    const current = useTempo.getState();
    const live = current.tasks.find((t) => t.id === task.id);
    if (!live) throw new Error("This task changed. Pull down to refresh.");
    await current.save("task", { ...live, ...change });
  };
  return (
    <View
      style={[
        {
          gap: 10,
          padding: 20,
          borderRadius: 28,
          backgroundColor: late ? theme.sun : theme.accent,
          ...shadow.glow,
        },
        gradient(late ? gradients.sun : gradients.now),
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ fontFamily: theme.fonts.bold, fontSize: 11.5, letterSpacing: 1.3, color: "rgba(255,255,255,0.9)" }}>
          {label}
        </Text>
        <Pill>{localParts(new Date(start), timezone).clock}</Pill>
      </View>
      <Text
        accessibilityLabel={`${label.toLowerCase()} ${clockText(count)}`}
        style={{ fontFamily: theme.fonts.heavy, fontSize: 52, lineHeight: 56, letterSpacing: -2, color: theme.surface, fontVariant: ["tabular-nums"] }}
      >
        {late ? "Go now" : clockText(count)}
      </Text>
      <Text style={{ fontFamily: theme.fonts.heavy, fontSize: 21, lineHeight: 26, color: theme.surface, letterSpacing: -0.3 }}>
        {task.title}
      </Text>
      {!!task.note && (
        <Text style={{ fontFamily: theme.fonts.medium, fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.88)" }}>
          {task.note}
        </Text>
      )}
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        <Pill>{task.duration} min</Pill>
        {task.fixed !== false && <Pill>Fixed time</Pill>}
        {!!project && <Pill>{project}</Pill>}
        {task.priority === "high" && <Pill>High priority</Pill>}
      </View>
      {!!task.steps?.length && (
        <View style={{ gap: 6, padding: 12, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)" }}>
          {task.steps.map((step, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10 }}>
              <Text style={{ fontFamily: theme.fonts.bold, fontSize: 12.5, color: "rgba(255,255,255,0.7)", width: 14 }}>{i + 1}</Text>
              <Text style={{ flex: 1, fontFamily: theme.fonts.medium, fontSize: 13.5, lineHeight: 19, color: theme.surface }}>{step}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        {started ? (
          <Action
            title="Done"
            icon="check"
            variant="light"
            compact
            busyTitle="Saving…"
            style={{ flex: 1 }}
            run={() => save({ status: "completed", completedAt: new Date().toISOString(), startedAt: null })}
          />
        ) : (
          <Action
            title={due ? "Start now" : "Start early"}
            icon="bolt"
            variant="light"
            compact
            busyTitle="Starting…"
            style={{ flex: 1 }}
            run={() => save({ startedAt: new Date().toISOString() })}
          />
        )}
        <Tap
          accessibilityRole="button"
          accessibilityLabel="Break it into tiny steps"
          onPress={() => talk(`I'm struggling to start "${task.title}". Break it into tiny steps so I can begin right now.`)}
          style={{
            flex: 1,
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.16)",
          }}
        >
          <Icon name="sparkle" size={16} color={theme.surface} />
          <Text style={{ fontFamily: theme.fonts.bold, fontSize: 13.5, color: theme.surface }}>I’m stuck</Text>
        </Tap>
        {started && (
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Stop the timer"
            onPress={() => void save({ startedAt: null }).catch(() => undefined)}
            style={{ width: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)" }}
          >
            <Icon name="redo" size={17} color={theme.surface} />
          </Tap>
        )}
      </View>
    </View>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)" }}>
      <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 12, color: theme.surface }}>{children}</Text>
    </View>
  );
}
