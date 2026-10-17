import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeAiContent } from "./ai.ts";
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
        { stop_reason: "end_turn", content: [{ type: "text", text }] },
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
        stop_reason: "max_tokens",
        content: [{ type: "text", text: JSON.stringify(content) }],
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
      decodeAiContent({ content: [{ type: "text", text }] }, "task-extraction"),
    );
});
