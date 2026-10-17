import { router, usePathname, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../design/tokens";
const destinations: { path: Href; title: string; icon: string }[] = [
  { path: "/", title: "Today", icon: "⌂" },
  { path: "/planning", title: "Tell Tempo", icon: "✦" },
  { path: "/settings", title: "Settings", icon: "☷" },
];
export function BottomBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderTopWidth: 1,
        borderTopColor: theme.line,
        paddingBottom: insets.bottom,
        paddingTop: 12,
        flexDirection: "row",
        minHeight: 82,
      }}
    >
      {destinations.map((item) => {
        const selected = pathname === item.path;
        return (
          <Pressable
            key={item.title}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.title}
            onPress={() => router.navigate(item.path)}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 7,
              minHeight: 52,
              borderTopWidth: 3,
              borderTopColor: selected ? theme.accent : "transparent",
              paddingTop: 6,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                color: selected ? theme.accent : theme.muted,
                fontFamily: theme.fonts.bold,
              }}
            >
              {item.icon}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: selected ? theme.accent : theme.muted,
                fontFamily: selected ? theme.fonts.bold : theme.fonts.regular,
              }}
            >
              {item.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
