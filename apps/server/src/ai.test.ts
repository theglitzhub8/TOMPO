import { test } from "node:test";
import assert from "node:assert/strict";
import { calendar, decodeAiContent } from "./ai.ts";
const content = {
  tasks: [
    {
      title: "Write proposal",
      duration: 90,
      clock: null,
      steps: ["Outline", "Draft", "Review"],
    },
  ],
};
test("valid provider JSON and fenced JSON are both decoded and validated", () => {
  for (const text of [
    JSON.stringify(content),
    "```json\n" + JSON.stringify(content) + "\n```",
  ]) {
    assert.deepEqual(
      decodeAiContent(
        { choices: [{ finish_reason: "stop", message: { content: text } }] },
        "task-extraction",
      ),
      content,
    );
  }
});
test("truncated, malformed, empty and invalid AI plans never reach persistence", () => {
  assert.throws(() =>
    decodeAiContent(
      {
        choices: [
          { finish_reason: "length", message: { content: JSON.stringify(content) } },
        ],
      },
      "task-extraction",
    ),
  );
  for (const text of [
    "not JSON",
    "{}",
    '{"tasks":[]}',
    JSON.stringify({ tasks: [{ ...content.tasks[0], clock: "25:00" }] }),
    JSON.stringify({ tasks: [{ ...content.tasks[0], duration: "90" }] }),
  ])
    assert.throws(() =>
      decodeAiContent({ choices: [{ message: { content: text } }] }, "task-extraction"),
    );
});
test("provider deadlines, priorities and named projects survive validation; impossible dates fail",()=>{
  const item={...content.tasks[0],dueDay:"2026-10-24",priority:"high",project:"Launch"};
  const decoded=decodeAiContent({choices:[{message:{content:JSON.stringify({tasks:[item]})}}]},"task-extraction");
  assert.equal(decoded.tasks[0].dueDay,"2026-10-24");assert.equal(decoded.tasks[0].priority,"high");
  for(const extra of [{dueDay:"2026-02-30"},{priority:"critical"},{project:42}]) assert.throws(()=>decodeAiContent({choices:[{message:{content:JSON.stringify({tasks:[{...item,...extra}]})}}]},"task-extraction"));
});
test("week plans keep each task's day and note; impossible days fail", () => {
  const item = { ...content.tasks[0], day: "2026-11-16", note: "Get the hard part done while you're fresh." };
  const decoded = decodeAiContent({ choices: [{ message: { content: JSON.stringify({ tasks: [item] }) } }] }, "task-extraction");
  assert.equal(decoded.tasks[0].day, "2026-11-16");
  assert.equal(decoded.tasks[0].note, item.note);
  for (const extra of [{ day: "2026-11-31" }, { day: "Monday" }, { note: 7 }])
    assert.throws(() => decodeAiContent({ choices: [{ message: { content: JSON.stringify({ tasks: [{ ...item, ...extra }] }) } }] }, "task-extraction"));
});
test("the calendar names two weeks of dates from the planned day", () => {
  const days = calendar("2026-11-14");
  assert.equal(days.length, 14);
  assert.equal(days[0], "2026-11-14 Saturday");
  assert.equal(days[2], "2026-11-16 Monday");
  assert.equal(days[13], "2026-11-27 Friday");
});
