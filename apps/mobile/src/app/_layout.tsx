import { useEffect } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { useFonts } from "expo-font";
import { Stack, usePathname, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTempo } from "../data/store";
import { WidgetSync } from "../lib/widgets";
import { Brand } from "../components/brand";
import { CelebrationLayer, useCompletionTreats } from "../components/celebration";
import { installCrashReporting, reportCrash, setCrashScreen } from "../lib/crash";
import { theme, fontAssets, gradient, gradients } from "../design/tokens";

installCrashReporting();

/** Shown instead of a blank screen when something breaks while drawing a screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    void reportCrash(error);
  }, [error]);
  return (
    <View style={[{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 32, backgroundColor: theme.night }, gradient(gradients.nightGlow)]}>
      <Text style={{ fontSize: 30, fontWeight: "800", color: theme.surface, textAlign: "center" }}>Something went wrong.</Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: theme.darkMuted, textAlign: "center", maxWidth: 320 }}>
        Your plan is safe. We’ve been sent a report so we can fix it.
      </Text>
      <Text
        accessibilityRole="button"
        onPress={() => void retry()}
        style={{ marginTop: 8, paddingHorizontal: 26, paddingVertical: 14, borderRadius: 999, overflow: "hidden", backgroundColor: theme.accent, color: theme.surface, fontSize: 16, fontWeight: "700" }}
      >
        Try again
      </Text>
    </View>
  );
}
const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
export default function Layout() {
  const { booting, ready, user, initialize } = useTempo();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  const signedIn = !!user && ready;
  useCompletionTreats();
  const pathname = usePathname();
  useEffect(() => setCrashScreen(pathname), [pathname]);
  return (
    <SafeAreaProvider>
      <WidgetSync />
      <QueryClientProvider client={client}>
        <StatusBar style={booting || !signedIn ? "light" : "dark"} />
        {booting || (!fontsLoaded && !fontError) ? (
          <View
            style={[
              {
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                gap: 28,
                backgroundColor: theme.night,
              },
              gradient(gradients.nightGlow),
            ]}
          >
            {fontsLoaded && <Brand large light />}
            <ActivityIndicator color={theme.mint} />
            {fontsLoaded && (
              <Text
                style={{
                  fontFamily: theme.fonts.displayItalic,
                  fontSize: 20,
                  color: theme.darkMuted,
                }}
              >
                Opening your day…
              </Text>
            )}
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "fade",
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen
                name="auth/index"
                options={{ contentStyle: { backgroundColor: theme.night } }}
              />
            </Stack.Protected>
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="week" />
              <Stack.Screen name="team" />
              <Stack.Screen name="inbox" />
              <Stack.Screen name="calendar" />
              <Stack.Screen name="next" />
              <Stack.Screen name="talk" options={{ animation: "slide_from_bottom" }} />
              <Stack.Screen name="my-week" />
              <Stack.Screen
                name="celebrate"
                options={{ presentation: "fullScreenModal", animation: "fade" }}
              />
              <Stack.Screen
                name="onboarding"
                options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }}
              />
              <Stack.Screen name="reports" options={{ animation: "default" }} />
              <Stack.Screen
                name="notification-test"
                options={{ animation: "default" }}
              />
            </Stack.Protected>
          </Stack>
        )}
        {signedIn && <CelebrationLayer />}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
