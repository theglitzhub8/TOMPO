const clip = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Keeps only the fields a crash report may carry, each trimmed. */
export function crashReport(input: any) {
  if (!input || typeof input !== "object" || typeof input.message !== "string" || !input.message.trim()) return null;
  return {
    message: clip(input.message, 1000),
    stack: clip(input.stack, 6000),
    screen: clip(input.screen, 200),
    version: clip(input.version, 40),
    platform: ["ios", "android", "web"].includes(input.platform) ? input.platform : "unknown",
    fatal: input.fatal === true,
  };
}
