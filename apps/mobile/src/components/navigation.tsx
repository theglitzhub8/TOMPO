import { router, usePathname, type Href } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, shadow, gradient, gradients } from "../design/tokens";
import { Icon, Tap, type IconName } from "./ui";
const destinations: {
  path: Href;
  title: string;
  icon: IconName;
  primary?: boolean;
}[] = [
  { path: "/", title: "Today", icon: "home" },
  { path: "/projects", title: "Projects", icon: "folder" },
  // The helper sits in the middle: one tap to talk to Tempo.
  { path: "/talk", title: "Talk to Tempo", icon: "mic", primary: true },
  { path: "/tasks", title: "Tasks", icon: "list" },
  { path: "/settings", title: "Settings", icon: "tune" },
];
export function BottomBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: theme.background,
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: 8,
        paddingHorizontal: 20,
        alignItems: "center",
      }}
    >
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            maxWidth: 440,
            height: 68,
            paddingHorizontal: 6,
            borderRadius: 34,
            backgroundColor: theme.night,
            ...shadow.lifted,
          },
          gradient(gradients.night),
        ]}
      >
        {destinations.map((item) => {
          const selected = pathname === item.path;
          if (item.primary)
            return (
              <View key={item.title} style={{ flex: 1, alignItems: "center" }}>
                <Tap
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.title}
                  onPress={() => router.navigate(item.path)}
                  scale={0.92}
                  style={[
                    {
                      width: 54,
                      height: 54,
                      borderRadius: 27,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: theme.accent,
                      borderWidth: 3,
                      borderColor: selected
                        ? "rgba(255,255,255,0.85)"
                        : "rgba(255,255,255,0.08)",
                      ...shadow.glow,
                    },
                    gradient(gradients.coral),
                  ]}
                >
                  <Icon name={item.icon} size={24} color={theme.surface} />
                </Tap>
              </View>
            );
          return (
            <Tap
              key={item.title}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={item.title}
              onPress={() => router.navigate(item.path)}
              style={{ flex: 1, alignItems: "center" }}
            >
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  height: 52,
                  minWidth: 56,
                  paddingHorizontal: 6,
                  borderRadius: 18,
                  backgroundColor: selected
                    ? "rgba(255,255,255,0.10)"
                    : "transparent",
                }}
              >
                <Icon
                  name={item.icon}
                  size={21}
                  color={selected ? theme.surface : theme.darkMuted}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 10.5,
                    color: selected ? theme.surface : theme.darkMuted,
                    fontFamily: selected
                      ? theme.fonts.bold
                      : theme.fonts.medium,
                  }}
                >
                  {item.title}
                </Text>
              </View>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}
