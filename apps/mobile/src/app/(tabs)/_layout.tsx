import { Tabs } from "expo-router";
import { BottomBar } from "../../components/navigation";
export default function Layout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => <BottomBar />}>
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="planning" options={{ title: "Tell Tempo" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      <Tabs.Screen name="projects" options={{ href: null }} />
      <Tabs.Screen name="tasks" options={{ href: null }} />
      <Tabs.Screen name="assistant" options={{ href: null }} />
      <Tabs.Screen name="health" options={{ href: null }} />
    </Tabs>
  );
}
