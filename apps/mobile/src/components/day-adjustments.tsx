import { useState } from "react";
import { View } from "react-native";
import { Action, Body, Button, Card, Field, Heading, Notice } from "./ui";
import { useTempo, isSharedId, sharedPlanTasks, type Task } from "../data/store";
import { carryForward, dayReview, reviseDay, shiftDay } from "../../../../packages/core/src/day-lifecycle";
import { localParts } from "../../../../packages/core/src/scheduling";

export function DayAdjustment({ day, onClose }: { day: string; onClose: () => void }) {
  const { preferences, revision } = useTempo();
  const [from, setFrom] = useState(localParts(new Date(), preferences.timezone).clock);
  const [end, setEnd] = useState(preferences.dayEnd || "21:00");
  const [preview, setPreview] = useState<ReturnType<typeof reviseDay> | null>(null);
  const [reviewedRevision, setReviewedRevision] = useState(0);
  const [before, setBefore] = useState<Task[]>([]);
  const [saved, setSaved] = useState(false);
  const changed = preview?.tasks.filter(t => !isSharedId(t.id) && before.some(old => old.id === t.id && old.scheduledAt !== t.scheduledAt)) ?? [];
  const clock = (at: string | null) => at ? localParts(new Date(at), preferences.timezone).clock : "Waiting";
  return <Card>
    <Heading serif>Let’s make room again.</Heading>
    <Body>Choose when you’re free and when you want to finish. Appointments, shared work, and completed tasks stay in place.</Body>
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {[15, 30, 60].map(minutes => <Button key={minutes} title={`Free in ${minutes} min`} compact variant="secondary" onPress={() => {
        const at = localParts(new Date(Date.now() + minutes * 60000), preferences.timezone);
        if (at.date === day) { setFrom(at.clock); setPreview(null); setSaved(false); }
      }} />)}
    </View>
    <Field label={`Available from HH:mm · ${preferences.timezone}`} value={from} onChangeText={v => { setFrom(v); setPreview(null); setSaved(false); }} />
    <Field label="Finish by HH:mm" value={end} onChangeText={v => { setEnd(v); setPreview(null); setSaved(false); }} />
    <Action title="Preview revised day" variant="secondary" run={async () => {
      const current = useTempo.getState();
      const ordered = [...current.tasks, ...sharedPlanTasks(current.shares.incoming)].sort((a, b) => (a.scheduledAt || "z").localeCompare(b.scheduledAt || "z"));
      const revised = reviseDay(ordered, current.routines, day, current.preferences.timezone, new Date(), from, end);
      setBefore(current.tasks); setReviewedRevision(current.revision); setPreview(revised); setSaved(false);
    }} />
    {preview && <>
      <Heading small>{changed.length} tasks move · {preview.overflow.filter(t => !isSharedId(t.id)).length} waiting</Heading>
      {changed.map(t => <Body key={t.id} small>{t.title}: {clock(before.find(old => old.id === t.id)!.scheduledAt)} → {clock(t.scheduledAt)}</Body>)}
      {preview.warnings.map((warning, i) => <Notice key={i} tone="danger">{warning}</Notice>)}
      {revision !== reviewedRevision && !saved && <Notice tone="danger">Your plan changed. Preview again before saving.</Notice>}
      {!saved && revision === reviewedRevision && <Action title="Use this plan" run={async () => {
        // Recompute from the current clock so a long-open preview cannot save work in the past.
        const fresh = reviseDay([...before, ...sharedPlanTasks(useTempo.getState().shares.incoming)].sort((a, b) => (a.scheduledAt || "z").localeCompare(b.scheduledAt || "z")), useTempo.getState().routines,
          day, preferences.timezone, new Date(), from, end);
        const own = fresh.tasks.filter(t => !isSharedId(t.id));
        if (own.some(t => t.scheduledAt !== preview.tasks.find(p => p.id === t.id)?.scheduledAt)) {
          setPreview(fresh);
          throw new Error("Time has moved on. Review the updated times, then save again.");
        }
        await useTempo.getState().saveReviewedPlan(changed, end, reviewedRevision);
        setSaved(true);
      }} />}
    </>}
    {saved && <Notice tone="mint">Your revised day is saved.</Notice>}
    <Button title={saved ? "Close" : "Cancel"} variant="ghost" onPress={onClose} />
  </Card>;
}

export function DailyWrapUp({ day }: { day: string }) {
  const [reviewDay, setReviewDay] = useState(day);
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Button title="This day" compact variant={reviewDay === day ? "accent" : "secondary"} onPress={() => setReviewDay(day)} />
      <Button title="Previous day" compact variant={reviewDay !== day ? "accent" : "secondary"} onPress={() => setReviewDay(shiftDay(day, -1))} />
    </View>
    <WrapUpReview key={reviewDay} day={reviewDay} />
  </View>;
}

function WrapUpReview({ day }: { day: string }) {
  const { tasks, preferences, revision } = useTempo();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const review = dayReview(tasks, day, preferences.timezone);
  const eligible = review.unfinished.filter(t => t.fixed === false && !t.recurrence && !t.seriesId);
  const visibleSelection = selected.filter(id => eligible.some(t => t.id === id));
  return <Card>
    <Heading serif>A moment to wrap up.</Heading>
    <Body>{review.completed.length} of {review.planned.length} planned tasks finished on {day} · {review.minutes} planned minutes completed.</Body>
    {!!review.carried.length && <Body small>{review.carried.length} carried to a later day.</Body>}
    <Button title={open ? "Hide wrap-up" : "Review unfinished tasks"} variant="secondary" onPress={() => setOpen(!open)} />
    {open && <>
      {!review.unfinished.length && <Body>Nothing unfinished for this day. Enjoy the space you’ve made.</Body>}
      {review.unfinished.map(t => <View key={t.id} style={{ gap: 6 }}>
        <Body>{t.title} · {t.duration} min</Body>
        {eligible.some(item => item.id === t.id) ? <Button compact
          title={visibleSelection.includes(t.id) ? `Selected for ${shiftDay(day, 1)}` : `Carry to ${shiftDay(day, 1)}`}
          variant={visibleSelection.includes(t.id) ? "accent" : "secondary"}
          onPress={() => setSelected(ids => ids.includes(t.id) ? ids.filter(id => id !== t.id) : [...ids, t.id])} />
          : <Body small>{t.recurrence || t.seriesId ? "Recurring task: its next occurrence is handled separately." : "Fixed appointment: mark it done or edit its time in Tasks."}</Body>}
      </View>)}
      {!!visibleSelection.length && <Action title={`Move ${visibleSelection.length} to ${shiftDay(day, 1)}`} run={async () => {
        const current = useTempo.getState();
        const changes = carryForward(current.tasks, visibleSelection, day, current.preferences.timezone);
        await current.saveReviewedPlan(changes, current.preferences.dayEnd || "21:00", revision);
        setSelected([]); setMessage(`Selected tasks are saved for ${shiftDay(day, 1)}, ready to plan.`);
      }} />}
      {!!message && <Notice tone="mint">{message}</Notice>}
    </>}
  </Card>;
}
