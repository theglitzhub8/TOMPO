import { View, Text } from "react-native";
import { Screen, Card, Body, Icon, theme, type IconName } from "../components/ui";
import { ReminderSettings } from "../components/reminder-card";

const steps: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: "bellRing",
    title: "When a task starts",
    detail: "“It’s time: Team meeting”, with Start, In 10 min, and Already done.",
  },
  {
    icon: "history",
    title: "If you haven’t started",
    detail: "Firm sends one more nudge 10 minutes later; Strict sends two. Gentle sends none.",
  },
  {
    icon: "checkCircle",
    title: "When it should be finished",
    detail: "“Done with Team meeting?”, with Yes, done and 15 more min.",
  },
  {
    icon: "person",
    title: "Tasks with teammates",
    detail: "You’re notified when someone adds you, joins, finishes, or moves a shared task. Accepted tasks remind you too.",
  },
];

export default function Notifications() {
  return (
    <Screen
      eyebrow="REMINDERS"
      title="A nudge,"
      titleAccent="right on time."
      subtitle="Tempo schedules reminders on this phone, so they arrive even without internet."
    >
      <Card style={{ gap: 18 }}>
        {steps.map((step) => (
          <View key={step.title} style={{ flexDirection: "row", gap: 14 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.accentSoft,
              }}
            >
              <Icon name={step.icon} size={19} color={theme.accentDeep} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: theme.fonts.bold, fontSize: 15, color: theme.ink }}>
                {step.title}
              </Text>
              <Body small>{step.detail}</Body>
            </View>
          </View>
        ))}
      </Card>
      <View style={{ borderRadius: theme.radius, backgroundColor: theme.surface, overflow: "hidden" }}>
        <ReminderSettings />
      </View>
      <Body small>
        Reminders cover the next two days and refresh whenever your plan changes or you
        open Tempo. A teammate’s change reaches your phone the next time Tempo syncs.
        Your phone’s Focus or Do Not Disturb settings can still hold reminders back.
      </Body>
    </Screen>
  );
}
