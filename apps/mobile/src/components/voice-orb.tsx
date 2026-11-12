import { useEffect, useState } from "react";
import { Animated, Easing, Platform, Text, View } from "react-native";
import { Icon, Tap, theme } from "./ui";
import { shadow, gradient, gradients } from "../design/tokens";

const native = Platform.OS !== "web";

export function VoiceOrb({
  listening,
  starting = false,
  disabled = false,
  onPress,
  hint,
  error,
}: {
  listening: boolean;
  starting?: boolean;
  disabled?: boolean;
  onPress: () => void;
  hint: string;
  error?: string;
}) {
  const pulse = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (!listening) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: native,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);
  const ring = (offset: number) => {
    const phase = Animated.modulo(Animated.add(pulse, offset), 1);
    return {
      opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
      transform: [
        { scale: phase.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) },
      ],
    };
  };
  const title = listening
    ? "Listening… tap to finish"
    : starting
      ? "Opening microphone…"
      : "Tap to talk";
  return (
    <View style={{ alignItems: "center", gap: 14, paddingVertical: 6 }}>
      <View
        style={{ width: 132, height: 132, alignItems: "center", justifyContent: "center" }}
      >
        {listening &&
          [0, 0.5].map((offset) => (
            <Animated.View
              key={offset}
              style={[
                {
                  position: "absolute",
                  width: 92,
                  height: 92,
                  borderRadius: 46,
                  backgroundColor: theme.accent,
                },
                ring(offset),
              ]}
            />
          ))}
        <Tap
          accessibilityRole="button"
          accessibilityLabel={listening ? "Finish speaking" : "Tell Tempo your day"}
          accessibilityState={{ disabled: disabled || starting }}
          disabled={disabled || starting}
          onPress={onPress}
          scale={0.92}
          style={[
            {
              width: 92,
              height: 92,
              borderRadius: 46,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: listening ? theme.ink : theme.accent,
              borderWidth: 6,
              borderColor: listening ? "rgba(15,26,36,0.12)" : "rgba(255,255,255,0.35)",
              opacity: disabled ? 0.45 : 1,
              ...(listening ? shadow.lifted : shadow.glow),
            },
            gradient(listening ? gradients.night : gradients.coral),
          ]}
        >
          <Icon name={listening ? "stop" : "mic"} size={36} color={theme.surface} />
        </Tap>
      </View>
      <View style={{ alignItems: "center", gap: 4, maxWidth: 320 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bold,
            fontSize: 16,
            color: listening ? theme.accent : theme.ink,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.regular,
            fontSize: 13,
            lineHeight: 19,
            color: theme.muted,
            textAlign: "center",
          }}
        >
          {hint}
        </Text>
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{
              fontFamily: theme.fonts.medium,
              fontSize: 13,
              lineHeight: 19,
              color: theme.danger,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}
