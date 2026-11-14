import { router, usePathname, type Href } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, shadow } from "../design/tokens";
import { Icon, Tap, type IconName } from "./ui";
import { Orb } from "./orb";

const destinations: { path: Href; title: string; icon: IconName; match: string[] }[] = [
  { path: "/", title: "Today", icon: "home", match: ["/", "/planning"] },
  { path: "/week", title: "Week", icon: "calendar", match: ["/week", "/my-week", "/calendar"] },
  { path: "/projects", title: "Goals", icon: "folder", match: ["/projects", "/team"] },
  { path: "/settings", title: "Me", icon: "person", match: ["/settings", "/tasks", "/reports", "/inbox"] },
];

export function BottomBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const item = (d: (typeof destinations)[number]) => {
    const selected = d.match.includes(pathname);
    return (
      <Tap
        key={d.title}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={d.title}
        onPress={() => router.navigate(d.path)}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3, height: 56 }}
      >
        <Icon name={d.icon} size={22} color={selected ? theme.accent : theme.faint} />
        <Text
          numberOfLines={1}
          style={{
            fontSize: 10.5,
            color: selected ? theme.accent : theme.muted,
            fontFamily: selected ? theme.fonts.bold : theme.fonts.semibold,
          }}
        >
          {d.title}
        </Text>
      </Tap>
    );
  };
  return (
    <View
      style={{
        backgroundColor: theme.background,
        paddingBottom: Math.max(insets.bottom, 10),
        paddingTop: 6,
        paddingHorizontal: 16,
        alignItems: "center",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          maxWidth: 460,
          height: 64,
          paddingHorizontal: 6,
          borderRadius: 32,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          ...shadow.lifted,
        }}
      >
        {destinations.slice(0, 2).map(item)}
        {/* Tempo, the helper, sits in the middle: one tap to talk. */}
        <View style={{ flex: 1, alignItems: "center" }}>
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Talk to Tempo"
            onPress={() => router.navigate("/talk")}
            scale={0.9}
            style={{ marginTop: -26 }}
          >
            <Orb size={58} />
          </Tap>
        </View>
        {destinations.slice(2).map(item)}
      </View>
    </View>
  );
}
