import { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTempo } from "../data/store";
import { Screen, Body, Button } from "../components/ui";
const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
export default function Layout() {
  const { ready, error, initialize } = useTempo();
  const [fontsLoaded, fontError] = useFonts({
    "Inter-Regular": require("../../assets/fonts/Inter-Regular.ttf"),
    "Inter-Bold": require("../../assets/fonts/Inter-Bold.ttf"),
  });
  useEffect(() => {
    void initialize();
  }, [initialize]);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        {ready && (fontsLoaded || fontError) ? (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="onboarding"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="reports" />
            <Stack.Screen name="notification-test" />
          </Stack>
        ) : (
          <Screen title="TEMPO">
            <Body>
              {error
                ? `Unable to open local data: ${error}`
                : "Opening your local workspace…"}
            </Body>
            {error && <Button title="Retry" onPress={initialize} />}
          </Screen>
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
