import { test } from "node:test";
import assert from "node:assert/strict";
import { PlanningLimit, validatePlanningInput } from "./planning.ts";

test("capture validation accepts a whole paragraph", () => {
  const input = {
    text: "Wash clothes and finish my proposal. Meeting at 2pm.",
    day: "2026-10-17",
    timezone: "Asia/Shanghai",
  };
  assert.deepEqual(validatePlanningInput(input), input);
});
test("invalid dates, zones, oversized captures and blank inputs fail before provider calls", () => {
  for (const input of [
    { text: "", day: "2026-10-17", timezone: "UTC" },
    { text: "Read", day: "2026-02-31", timezone: "UTC" },
    { text: "Read", day: "2026-10-17", timezone: "Not/a-zone" },
    { text: "x".repeat(12001), day: "2026-10-17", timezone: "UTC" },
  ])
    assert.throws(() => validatePlanningInput(input));
});
test("planning is bounded per account and becomes available after the window", () => {
  const limits = new PlanningLimit();
  for (let i = 0; i < 20; i++) assert.equal(limits.allow("test-a", 100), true);
  assert.equal(limits.allow("test-a", 100), false);
  assert.equal(limits.allow("test-b", 100), true);
  assert.equal(limits.allow("test-a", 3600100), true);
});
