import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import {
  Screen,
  Body,
  Chip,
  Group,
  ListRow,
  Icon,
  theme,
} from "../../components/ui";
import { ReminderSettings } from "../../components/reminder-card";
import { DriveSettings } from "../../components/drive-settings";
import { AccountActions, BackendConnection } from "../../components/backend-connection";
import { BlockedPeople } from "../../components/blocked-people";
import { useTempo } from "../../data/store";
import * as WebBrowser from "expo-web-browser";
import { apiBase } from "../../lib/api";

const openPage = async (path: string) => WebBrowser.openBrowserAsync(`${await apiBase()}${path}`);
export default function Settings() {
  const { preferences, cloudRequest } = useTempo();
  const [ai, setAi] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    cloudRequest<{ aiConfigured: boolean }>("/v1/connection")
      .then((r) => live && setAi(!!r.aiConfigured))
      .catch(() => live && setAi(false));
    return () => {
      live = false;
    };
  }, [cloudRequest]);
  return (
    <Screen
      eyebrow="ME"
      title="Make it"
      titleAccent="yours."
    >
      <BackendConnection />
      <Group title="HOW HARD TEMPO PUSHES">
        <DriveSettings />
      </Group>
      <Group title="REMINDERS">
        <ReminderSettings />
      </Group>
      <Group title="TOOLS">
        <ListRow icon="doneAll" title="Progress" detail="Your completion, streaks and reports." onPress={()=>router.navigate("/reports")} />
        <ListRow icon="calendar" title="Weekly planning" detail="Fit your workload across seven realistic days." onPress={()=>router.navigate("/week")} />
        <ListRow icon="person" title="Shared projects" detail="Members, assignments, comments, and team busy times." onPress={()=>router.navigate("/team")} />
        <ListRow icon="inbox" title="Activity inbox" detail="Shared updates and approaching deadlines." onPress={()=>router.navigate("/inbox")} />
        <ListRow icon="event" title="Calendar" detail="Review calendar events before adding them to your plan." onPress={()=>router.navigate("/calendar")} />
        <ListRow icon="bolt" title="Next-task view and widget" detail="One clear next step, plus iOS home and lock-screen widgets." onPress={()=>router.navigate("/next")} last />
      </Group>
      <Group title="PLANNING">
        <ListRow
          icon="globe"
          title="Follows your phone’s time"
          detail={`${preferences.timezone} · plans and appointments use your phone’s clock and update when you travel.`}
          trailing={<Chip icon="check" tone="mint">Auto</Chip>}
        />
        <ListRow
          icon="sparkle"
          title="AI planning"
          detail={
            ai === null
              ? "Checking the connection…"
              : ai
                ? "Connected. Your words become tasks, times and steps."
                : "Not connected on this server. Tempo makes quick local plans instead."
          }
          trailing={
            ai === null ? undefined : (
              <Chip icon={ai ? "check" : "error"} tone={ai ? "mint" : "accent"}>
                {ai ? "On" : "Off"}
              </Chip>
            )
          }
        />
        <ListRow
          icon="routine"
          title="My week"
          detail="Class, work, gym: whatever repeats every week. Tempo plans around it."
          onPress={() => router.navigate("/my-week")}
        />
        <ListRow
          icon="folder"
          title="Projects"
          detail="Group tasks by what they’re for and track each one’s progress."
          onPress={() => router.navigate("/projects")}
        />
        <ListRow
          icon="list"
          title="Your tasks"
          detail="Edit tasks, change appointment times, and see things waiting for another day."
          onPress={() => router.navigate("/tasks")}
          last
        />
      </Group>
      <Group title="VOICE AND TEXT">
        <View style={{ padding: 18, gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.accentSoft,
              }}
            >
              <Icon name="wave" size={19} color={theme.accentDeep} />
            </View>
            <Text
              style={{
                flex: 1,
                fontFamily: theme.fonts.regular,
                fontSize: 14,
                lineHeight: 21,
                color: theme.inkSoft,
              }}
            >
              Tap Tell Tempo to speak or type everything in one go. You can edit
              the transcript before planning. Speech uses your phone’s
              recognition service and may need internet.
            </Text>
          </View>
          <Body small>
            Voice works in the installed Tempo app on iPhone and Android, and in Chrome on the web. If it’s unavailable, use your keyboard’s microphone to dictate
            into the same input.
          </Body>
        </View>
      </Group>
      <Group title="HELP AND PRIVACY">
        <ListRow icon="lock" title="Privacy policy" detail="What Tempo stores, why, and how to delete it." onPress={() => void openPage("/privacy")} />
        <ListRow icon="mail" title="Support" detail="Answers to common questions and how to reach us." onPress={() => void openPage("/support")} last />
      </Group>
      <BlockedPeople />
      <AccountActions />
      <Body small style={{ textAlign: "center", marginTop: 4 }}>
        Your plan follows your account across devices.
      </Body>
    </Screen>
  );
}
