import { Tabs } from "expo-router";
import { BottomBar } from "../../components/navigation";
export default function Layout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => <BottomBar />}>
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="planning" options={{ title: "Plan" }} />
      <Tabs.Screen name="projects" options={{ title: "Projects" }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks" }} />
      <Tabs.Screen name="assistant" options={{ title: "Calls" }} />
      <Tabs.Screen name="health" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
