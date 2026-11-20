import { test } from "node:test";
import assert from "node:assert/strict";
import { crashReport } from "./crash.ts";

test("crash reports keep only known, trimmed fields", () => {
  assert.equal(crashReport(null), null);
  assert.equal(crashReport({ message: "" }), null);
  const report = crashReport({ message: "x".repeat(5000), stack: "at Today", platform: "symbian", fatal: true, token: "secret" });
  assert.equal(report!.message.length, 1000);
  assert.equal(report!.platform, "unknown");
  assert.equal("token" in report!, false);
});
