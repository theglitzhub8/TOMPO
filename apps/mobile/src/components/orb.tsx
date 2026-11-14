import { useEffect, useState } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { theme, shadow, gradient, gradients } from "../design/tokens";

const native = Platform.OS !== "web";

/** Tempo's face: a glowing orb that breathes while it listens or thinks. */
export function Orb({ size = 32, active = false }: { size?: number; active?: boolean }) {
  const pulse = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
      }}
    >
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.accent,
            borderWidth: Math.max(2, size * 0.06),
            borderColor: "rgba(255,255,255,0.85)",
            ...shadow.glow,
          },
          gradient(gradients.orb),
        ]}
      />
    </Animated.View>
  );
}
