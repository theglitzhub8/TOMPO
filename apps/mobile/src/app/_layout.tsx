import { useEffect } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTempo } from "../data/store";
import { Brand } from "../components/brand";
import { theme } from "../design/tokens";
const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
export default function Layout() {
  const { booting, ready, user, initialize } = useTempo();
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
        {booting || (!fontsLoaded && !fontError) ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              gap: 24,
              backgroundColor: theme.background,
            }}
          >
            {fontsLoaded && <Brand large />}
            <ActivityIndicator color={theme.accent} />
            <Text style={{ color: theme.muted }}>
              Opening your Tempo account…
            </Text>
          </View>
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={!user || !ready}>
              <Stack.Screen name="auth/index" />
            </Stack.Protected>
            <Stack.Protected guard={!!user && ready}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="onboarding"
                options={{ presentation: "modal" }}
              />
              <Stack.Screen name="reports" />
              <Stack.Screen name="notification-test" />
            </Stack.Protected>
          </Stack>
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
