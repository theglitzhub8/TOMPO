import { Image, Text, View } from "react-native";
import { theme } from "../design/tokens";
export function Brand({ large = false }: { large?: boolean }) {
  if (large)
    return (
      <Image
        source={require("../../assets/brand/tempo-logo.png")}
        accessibilityLabel="Tempo logo"
        resizeMode="contain"
        style={{ width: 250, height: 84, alignSelf: "flex-start" }}
      />
    );
  return (
    <View
      accessibilityLabel="Tempo"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: large ? 12 : 9,
      }}
    >
      <Image
        source={require("../../assets/brand/tempo-app-icon.png")}
        accessibilityIgnoresInvertColors
        style={{
          width: large ? 48 : 32,
          height: large ? 48 : 32,
          borderRadius: large ? 14 : 10,
        }}
      />
      <Text
        style={{
          fontFamily: theme.fonts.bold,
          color: theme.ink,
          fontSize: large ? 30 : 23,
          letterSpacing: -1,
        }}
      >
        tempo
      </Text>
    </View>
  );
}
