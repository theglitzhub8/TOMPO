import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Dimensions, Easing, Platform, Text, View } from "react-native";
import { router } from "expo-router";
import { theme, shadow } from "../design/tokens";
import { useTempo } from "../data/store";
import * as session from "../lib/session";
import { celebrate, onBurst, type Burst } from "../lib/celebrate";
import { dayScore } from "../../../../packages/core/src/progress";
import { localParts } from "../../../../packages/core/src/scheduling";

const native = Platform.OS !== "web";
const colors = [theme.accent, theme.sun, theme.progress, theme.violet, "#FFC53D"];
const dayKey = "tempo-day-celebrated";

/** Celebrates every task the person finishes, wherever it was finished. */
export function useCompletionTreats() {
  useEffect(() => {
    return useTempo.subscribe((state, prev) => {
      if (state.tasks === prev.tasks || !state.user || state.user.id !== prev.user?.id) return;
      const before = new Map(prev.tasks.map((t) => [t.id, t.status]));
      const finished = state.tasks.filter(
        (t) =>
          t.status === "completed" &&
          before.get(t.id) === "pending" &&
          !!t.completedAt &&
          Date.now() - Date.parse(t.completedAt) < 120000,
      );
      if (!finished.length) return;
      const zone = state.preferences.timezone;
      const today = localParts(new Date(), zone).date;
      const score = dayScore(state.tasks, today, zone);
      if (score.planned > 0 && score.done === score.planned) {
        void session.getItemAsync(dayKey).then((last) => {
          if (last === today) return celebrate("task");
          void session.setItemAsync(dayKey, today);
          celebrate("day");
          router.navigate("/celebrate");
        });
      } else celebrate("task");
    });
  }, []);
}

type Piece = { x: number; delay: number; color: string; spin: number; drift: number; size: number };

/** Confetti and a cheer that float over any screen. */
export function CelebrationLayer() {
  const [burst, setBurst] = useState<Burst | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const fall = useState(() => new Animated.Value(0))[0];
  const toast = useState(() => new Animated.Value(0))[0];
  useEffect(
    () =>
      onBurst((b) => {
        void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
          const width = Dimensions.get("window").width;
          setBurst(b);
          setPieces(
            reduced
              ? []
              : Array.from({ length: b.kind === "day" ? 60 : 28 }, (_, i) => ({
                  x: Math.random() * width,
                  delay: Math.random() * 0.35,
                  color: colors[i % colors.length],
                  spin: (Math.random() - 0.5) * 900,
                  drift: (Math.random() - 0.5) * 120,
                  size: 6 + Math.random() * 6,
                })),
          );
          fall.setValue(0);
          toast.setValue(0);
          Animated.parallel([
            Animated.timing(fall, { toValue: 1, duration: 1800, easing: Easing.in(Easing.quad), useNativeDriver: native }),
            Animated.sequence([
              Animated.spring(toast, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 10 }),
              Animated.delay(1300),
              Animated.timing(toast, { toValue: 0, duration: 250, useNativeDriver: native }),
            ]),
          ]).start(({ finished }) => {
            if (finished) setBurst(null);
          });
        });
      }),
    [fall, toast],
  );
  if (!burst) return null;
  const height = Dimensions.get("window").height;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {pieces.map((p, i) => {
        const progress = fall.interpolate({
          inputRange: [0, p.delay, 1],
          outputRange: [0, 0, 1],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: -20,
              width: p.size,
              height: p.size * 1.6,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity: progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.9] }) },
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
      <Animated.View
        style={{
          position: "absolute",
          top: 70,
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 999,
          backgroundColor: theme.night,
          ...shadow.lifted,
          opacity: toast,
          transform: [
            { translateY: toast.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
            { scale: toast.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
          ],
        }}
      >
        <Text style={{ fontFamily: theme.fonts.bold, fontSize: 15, color: theme.surface }}>{burst.cheer}</Text>
        <Text style={{ fontFamily: theme.fonts.bold, fontSize: 13, color: theme.mint }}>+{burst.points}</Text>
      </Animated.View>
    </View>
  );
}
