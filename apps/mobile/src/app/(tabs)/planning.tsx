import { Screen } from "../../components/ui";
import { DayCapture } from "../../components/day-capture";
export default function Planning() {
  return (
    <Screen
      eyebrow="TELL TEMPO"
      title="A busy mind. A clear day."
      subtitle="Say it or type it. You don’t need a tidy list."
    >
      <DayCapture />
    </Screen>
  );
}
