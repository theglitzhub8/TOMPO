import { useEffect, useState } from "react";
import { TextInput } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Action, Body, Button, Card, Field, Heading, styles } from "./ui";
async function request(
  path: string,
  session: string,
  body?: unknown,
  base = "https://tempo-api.hafrik.com",
) {
  const parsed = new URL(base);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new Error("Use an HTTPS API URL");
  const response = await fetch(`${parsed.href.replace(/\/$/, "")}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export function BackendConnection() {
  const [url, setUrl] = useState("https://tempo-api.hafrik.com");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [token, setToken] = useState("");
  const [account, setAccount] = useState<{
    name: string;
    email: string;
  } | null>(null);
  const [status, setStatus] = useState(
    "Sign in for your personal Tempo account",
  );
  useEffect(() => {
    void Promise.all([
      SecureStore.getItemAsync("tempo-api-url"),
      SecureStore.getItemAsync("tempo-session"),
    ])
      .then(async ([u, t]) => {
        if (u) setUrl(u);
        if (t) {
          const result = await request(
            "/v1/auth/me",
            t,
            undefined,
            u || "https://tempo-api.hafrik.com",
          );
          setToken(t);
          setAccount(result.user);
          setStatus("Signed in · task sync is not enabled yet");
        }
      })
      .catch(() => setStatus("Session unavailable · sign in to reconnect"));
  }, []);
  return (
    <Card>
      <Heading>
        {account
          ? `Welcome, ${account.name}`
          : register
            ? "Create your Tempo account"
            : "Your personal Tempo"}
      </Heading>
      <Body>{account?.email || status}</Body>
      {!account && (
        <>
          <Field label="API URL" value={url} onChangeText={setUrl} />
          {register && (
            <Field label="Your name" value={name} onChangeText={setName} />
          )}
          <Field label="Email" value={email} onChangeText={setEmail} />
          <Body>Password · at least 12 characters</Body>
          <TextInput
            accessibilityLabel="Password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <Action
            title={register ? "Create account" : "Sign in"}
            run={async () => {
              const result = await request(
                register ? "/v1/auth/register" : "/v1/auth/login",
                "",
                { name, email, password },
                url,
              );
              await SecureStore.setItemAsync(
                "tempo-api-url",
                url.trim().replace(/\/$/, ""),
              );
              await SecureStore.setItemAsync("tempo-session", result.token);
              setToken(result.token);
              setAccount(result.user);
              setPassword("");
              setStatus("Signed in · task sync is not enabled yet");
            }}
          />
          <Button
            title={
              register
                ? "Already have an account? Sign in"
                : "New to Tempo? Create an account"
            }
            onPress={() => setRegister(!register)}
          />
        </>
      )}
      {account && (
        <>
          <Body>{status}</Body>
          <Action
            title="Check connection"
            run={async () => {
              const data = await request(
                "/v1/connection",
                token,
                undefined,
                url,
              );
              setStatus(
                `Database ready · AI ${data.aiConfigured ? "configured (not tested)" : "not configured"} · task sync not enabled yet`,
              );
            }}
          />
          <Action
            title="Sign out"
            run={async () => {
              await request("/v1/auth/logout", token, {}, url);
              await SecureStore.deleteItemAsync("tempo-session");
              setAccount(null);
              setToken("");
              setStatus("Signed out");
            }}
          />
        </>
      )}
      <Body small>
        Local tasks stay on this device. Account registration does not upload or
        separate your existing local workspace yet.
      </Body>
    </Card>
  );
}
