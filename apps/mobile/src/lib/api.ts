import * as session from "./session";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
  }
}
export async function apiBase() {
  const base = new URL(
    process.env.EXPO_PUBLIC_TEMPO_API_URL ||
      (await session.getItemAsync("tempo-api-url")) ||
      "https://tempo-api.hafrik.com",
  );
  const loopback =
    base.protocol === "http:" &&
    ["localhost", "127.0.0.1", "10.0.2.2"].includes(base.hostname);
  if (
    (!loopback && base.protocol !== "https:") ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error("Use a secure Tempo API address.");
  return base.href.replace(/\/$/, "");
}
export async function request<T>(
  base: string,
  path: string,
  token: string | null,
  body?: unknown,
  method?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(path === "/v1/plan" ? 30000 : 15000),
    });
  } catch {
    throw new Error(
      "Could not reach Tempo. Check your connection and try again.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Tempo returned an unreadable response. Please try again.");
  }
  if (!response.ok)
    throw new ApiError(
      data.error || "Could not complete that request.",
      response.status,
      data,
    );
  return data as T;
}
