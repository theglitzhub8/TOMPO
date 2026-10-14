import { Screen, Card, Body } from "../components/ui";
export default function Notifications() {
  return (
    <Screen title="Notification test" subtitle="Integration pending">
      <Card>
        <Body>
          Actual permission status: not queried. Notification delivery and
          permission requests are not implemented in this foundation build.
        </Body>
        <Body>
          iOS Focus can suppress reminders. Time Sensitive delivery depends on
          system permissions and user Focus settings; TEMPO cannot guarantee
          interruption.
        </Body>
        <Body>
          Android channels, vibration, and permitted priority settings will be
          configured in the reminder milestone. DND will be respected.
        </Body>
        <Body>
          Offline reminder policy is unit-tested; device scheduling remains
          pending. This screen does not claim notifications are enabled.
        </Body>
      </Card>
    </Screen>
  );
}
