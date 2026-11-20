import { useEffect } from "react";
import { AppState } from "react-native";
import { Tabs, router } from "expo-router";
import { BottomBar } from "../../components/navigation";
import { useTempo } from "../../data/store";
import { useReminders } from "../../lib/reminders";
// Teammates can change shared tasks, so pull updates while the app is open.
function useBackgroundSync() {
  const sync = useTempo((s) => s.sync);
  useEffect(() => {
    const run = () => void sync().catch(() => undefined);
    const timer = setInterval(run, 60000);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => {
      clearInterval(timer);
      app.remove();
    };
  }, [sync]);
}
/** New accounts go through first-run setup once. */
function useFirstRun() {
  const due = useTempo((s) => s.ready && !!s.user && !s.preferences.onboardingComplete);
  useEffect(() => {
    if (!due) return;
    const timer = setTimeout(() => router.push("/onboarding"), 300);
    return () => clearTimeout(timer);
  }, [due]);
}
export default function Layout() {
  useBackgroundSync();
  useReminders();
  useFirstRun();
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => <BottomBar />}>
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="projects" options={{ title: "Projects" }} />
      <Tabs.Screen name="planning" options={{ title: "Tell Tempo" }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      <Tabs.Screen name="assistant" options={{ href: null }} />
      <Tabs.Screen name="health" options={{ href: null }} />
    </Tabs>
  );
}
