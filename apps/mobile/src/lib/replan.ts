import { useTempo, isSharedId, sharedPlanTasks } from "../data/store";
import { localParts } from "../../../../packages/core/src/scheduling";
import { buildDay } from "../../../../packages/core/src/day-planner";

/** Re-fits today's flexible work from now on. Appointments never move. */
export async function replanFromNow() {
  const current = useTempo.getState();
  const day = localParts(new Date(), current.preferences.timezone).date;
  const dayEnd = current.preferences.dayEnd || "21:00";
  const revised = buildDay(
    [...current.tasks, ...sharedPlanTasks(current.shares.incoming)].sort((a, b) =>
      (a.scheduledAt || "z").localeCompare(b.scheduledAt || "z"),
    ),
    current.routines,
    day,
    current.preferences.timezone,
    new Date(),
    dayEnd,
    true,
  );
  const changed = revised.tasks.filter(
    (t) =>
      !isSharedId(t.id) &&
      current.tasks.some((old) => old.id === t.id && old.scheduledAt !== t.scheduledAt),
  );
  await current.saveReviewedPlan(changed, dayEnd, current.revision);
  return `Plan updated. ${revised.overflow.length} tasks waiting for space.${revised.warnings.length ? ` ${revised.warnings.join(" ")}` : ""}`;
}
