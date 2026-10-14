import { useEffect, useState } from "react";
import { TextInput } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Action, Body, Card, Field, Heading, styles } from "./ui";
export function BackendConnection() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState(
    "Not checked · local storage remains active",
  );
  useEffect(() => {
    void Promise.all([
      SecureStore.getItemAsync("tempo-api-url"),
      SecureStore.getItemAsync("tempo-api-token"),
    ])
      .then(([u, t]) => {
        setUrl(u ?? "");
        setToken(t ?? "");
      })
      .catch(() => setStatus("Unable to read saved connection"));
  }, []);
  return (
    <Card>
      <Heading>Backend connection</Heading>
      <Body>{status}</Body>
      <Field label="HTTPS API URL" value={url} onChangeText={setUrl} />
      <Body>Private pilot access token</Body>
      <TextInput
        accessibilityLabel="Private pilot access token"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={token}
        onChangeText={setToken}
        style={styles.input}
      />
      <Action
        title="Save & test connection"
        run={async () => {
          const base = new URL(url.trim());
          if (base.protocol !== "https:" || base.username || base.password)
            throw new Error("Enter an HTTPS URL without credentials");
          if (!token.trim()) throw new Error("Enter your private access token");
          setStatus("Connecting…");
          try {
            const response = await fetch(
              `${base.href.replace(/\/$/, "")}/v1/connection`,
              {
                headers: { Authorization: `Bearer ${token.trim()}` },
                signal: AbortSignal.timeout(10000),
              },
            );
            if (!response.ok)
              throw new Error(`Connection rejected (${response.status})`);
            const data = await response.json();
            if (data.connected !== true || data.database !== true)
              throw new Error("Unexpected server response");
            await SecureStore.setItemAsync(
              "tempo-api-url",
              base.href.replace(/\/$/, ""),
            );
            await SecureStore.setItemAsync("tempo-api-token", token.trim());
            setStatus(
              `Connected · database ready · AI ${data.aiConfigured ? "configured (not tested)" : "not configured"}. Task sync not enabled yet.`,
            );
          } catch (error) {
            setStatus("Connection failed · local data remains available");
            throw error;
          }
        }}
      />
      <Body small>
        This connection is for your private pilot account. It does not upload
        tasks or enable calls.
      </Body>
    </Card>
  );
}
