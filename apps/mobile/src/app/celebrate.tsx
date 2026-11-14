import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Icon } from "../components/ui";
import { Orb } from "../components/orb";
import { talk } from "../components/helper";
import { theme, gradient, gradients } from "../design/tokens";
import { useTempo } from "../data/store";
import { progress, taskDay } from "../../../../packages/core/src/progress";
import { localParts } from "../../../../packages/core/src/scheduling";

const span = (minutes: number) =>
  minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

/** The full-screen treat for finishing every task of the day. */
export default function Celebrate() {
  const { tasks, preferences } = useTempo();
  const zone = preferences.timezone;
  const today = localParts(new Date(), zone).date;
  const stats = progress(tasks, today, zone);
  const minutes = tasks
    .filter((t) => t.status === "completed" && taskDay(t, zone) === today)
    .reduce((sum, t) => sum + t.duration, 0);
  const close = () => (router.canGoBack() ? router.back() : router.navigate("/"));
  return (
    <View style={[{ flex: 1, backgroundColor: theme.night }, gradient(gradients.nightGlow)]}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 22, justifyContent: "center", maxWidth: 520, width: "100%", alignSelf: "center" }}>
          <View style={{ alignItems: "center", gap: 16 }}>
            <Orb size={84} active />
            <Text style={{ fontFamily: theme.fonts.bold, fontSize: 12, letterSpacing: 1.6, color: theme.mint }}>
              ALL {stats.today.planned} {stats.today.planned === 1 ? "TASK" : "TASKS"} DONE
            </Text>
            <Text style={{ fontFamily: theme.fonts.display, fontSize: 60, lineHeight: 60, color: theme.surface, textAlign: "center" }}>
              Day done.{"\n"}
              <Text style={{ fontFamily: theme.fonts.displayItalic, color: theme.mint }}>You showed up.</Text>
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Stat value={`${stats.today.done}/${stats.today.planned}`} label="tasks" />
            <Stat value={span(minutes)} label="of work" />
            <Stat value={`${stats.streak}`} label="day streak" hot />
          </View>
          <View style={{ gap: 6, padding: 18, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: theme.darkLine }}>
            <Text style={{ fontFamily: theme.fonts.bold, fontSize: 11, letterSpacing: 1.4, color: theme.mint }}>YOUR TREAT</Text>
            {preferences.treat ? (
              <>
                <Text style={{ fontFamily: theme.fonts.bold, fontSize: 19, color: theme.surface }}>{preferences.treat}</Text>
                <Text style={{ fontFamily: theme.fonts.regular, fontSize: 14, color: theme.darkMuted }}>You earned it. Enjoy it, guilt-free.</Text>
              </>
            ) : (
              <Text style={{ fontFamily: theme.fonts.medium, fontSize: 15, lineHeight: 22, color: theme.surface }}>
                Pick something you’ll look forward to, like an episode, a game or a snack. Set it in Me → Your treat.
              </Text>
            )}
          </View>
          <View style={{ flexDirection: "row", alignSelf: "center", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(123,77,255,0.25)" }}>
            <Icon name="sparkle" size={16} color={theme.surface} />
            <Text style={{ fontFamily: theme.fonts.bold, fontSize: 13.5, color: theme.surface }}>{stats.points} points in total</Text>
          </View>
          <View style={{ gap: 10 }}>
            <Button title="Plan tomorrow" icon="sun" variant="accent" onPress={() => { close(); talk("Help me plan tomorrow."); }} />
            <Button title="Close" variant="light" onPress={close} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ value, label, hot = false }: { value: string; label: string; hot?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2, paddingVertical: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: theme.darkLine }}>
      <Text style={{ fontFamily: theme.fonts.heavy, fontSize: 22, color: hot ? theme.sun : theme.surface }}>{value}</Text>
      <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 11.5, color: theme.darkMuted }}>{label}</Text>
    </View>
  );
}
