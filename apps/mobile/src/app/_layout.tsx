import { useEffect } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTempo } from "../data/store";
import { WidgetSync } from "../lib/widgets";
import { Brand } from "../components/brand";
import { theme, fontAssets, gradient, gradients } from "../design/tokens";
const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
export default function Layout() {
  const { booting, ready, user, initialize } = useTempo();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  const signedIn = !!user && ready;
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
              <Stack.Screen
                name="onboarding"
                options={{ presentation: "modal", animation: "default" }}
              />
              <Stack.Screen name="reports" options={{ animation: "default" }} />
              <Stack.Screen
                name="notification-test"
                options={{ animation: "default" }}
              />
            </Stack.Protected>
          </Stack>
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
