import { router } from "expo-router";
import { Screen, Card, Heading, Body, Button } from "../components/ui";
export default function Onboarding() {
  return (
    <Screen
      eyebrow="WELCOME TO TEMPO"
      title="Tell it all. Take it one at a time."
      subtitle="Your day starts with one conversation."
    >
      <Card>
        <Heading>Wake up. Let it out.</Heading>
        <Body>
          Say or type everything you need to do, including appointments and
          anything important.
        </Body>
        <Heading>Get a realistic plan.</Heading>
        <Body>
          Tempo finds room around your commitments, estimates task lengths, and
          leaves breathing room.
        </Body>
        <Heading>Follow your next step.</Heading>
        <Body>Mark things done. Replan from now when life happens.</Body>
        <Button
          title="Let’s plan my day →"
          onPress={() => router.replace("/planning")}
        />
      </Card>
    </Screen>
  );
}
