import { Image, Text, View } from "react-native";
import { theme } from "../design/tokens";
export function Brand({
  large = false,
  light = false,
}: {
  large?: boolean;
  light?: boolean;
}) {
  const size = large ? 44 : 32;
  return (
    <View
      accessibilityLabel="Tempo"
      style={{ flexDirection: "row", alignItems: "center", gap: large ? 12 : 9 }}
    >
      <Image
        source={require("../../assets/brand/tempo-app-icon.png")}
        accessibilityIgnoresInvertColors
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.3,
          borderWidth: light ? 1 : 0,
          borderColor: "rgba(255,255,255,0.14)",
        }}
      />
      <Text
        style={{
          fontFamily: theme.fonts.heavy,
          color: light ? theme.surface : theme.ink,
          fontSize: large ? 28 : 20,
          letterSpacing: large ? -1.2 : -0.8,
        }}
      >
        tempo
      </Text>
    </View>
  );
}
