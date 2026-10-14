import { useState } from "react";
import { Text, View } from "react-native";
import { Screen, Card, Heading, Body, Button, theme } from "../components/ui";
import { PreferencesForm } from "../components/preferences";
export default function Onboarding() {
  const [setup, setSetup] = useState(false);
  return (
    <Screen
      eyebrow="WELCOME TO TEMPO"
      title="Own your time."
      subtitle="Your personal accountability assistant."
    >
      <Card
        dark
        style={{
          minHeight: 180,
          paddingHorizontal: 24,
          paddingTop: 21,
          paddingBottom: 44,
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        <Text
          style={{
            fontSize: 50,
            fontFamily: theme.fonts.bold,
            color: theme.mint,
            textAlign: "center",
          }}
        >
          ✦
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.bold,
            fontSize: 21,
            color: theme.surface,
          }}
        >
          Your day. Under control.
        </Text>
      </Card>
      <Card style={{ minHeight: 140, marginTop: 4 }}>
        <Heading size={15}>Your assistant will help you:</Heading>
        <View>
          <Body>✓ Plan realistic days</Body>
          <Body>✓ Finish unfinished work</Body>
          <Body>✓ Protect your sleep and health</Body>
        </View>
      </Card>
      <View style={{ marginTop: 15 }}>
        <Button
          title={setup ? "Close preferences" : "Get started"}
          onPress={() => setSetup(!setup)}
        />
      </View>
      {setup && <PreferencesForm onboarding />}
    </Screen>
  );
}
