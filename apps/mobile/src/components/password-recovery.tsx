import { useState } from "react";
import { Card, Body, Action, Field, Button, Heading, Notice } from "./ui";
import { apiBase, request } from "../lib/api";
export function PasswordRecovery() {
  const [open, setOpen] = useState(false),
    [email, setEmail] = useState(""),
    [token, setToken] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState("");
  return (
    <Card>
      <Button
        title={open ? "Close password recovery" : "Forgot password?"}
        variant="ghost"
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <Heading small>Get back into your account.</Heading>
          <Field label="Account email" value={email} onChangeText={setEmail} />
          <Action
            title="Email me a reset code"
            variant="secondary"
            run={async () => {
              const result = await request<{ message: string }>(
                await apiBase(),
                "/v1/auth/forgot",
                null,
                { email },
              );
              setMessage(result.message);
            }}
          />
          <Body small>
            Already have a reset code? Paste it below. Updating your password
            signs out existing sessions.
          </Body>
          <Field
            label="Reset code from email"
            value={token}
            onChangeText={setToken}
          />
          <Field
            label="New password (12–128 characters)"
            value={password}
            onChangeText={setPassword}
            secure
          />
          <Action
            title="Update password"
            run={async () => {
              const result = await request<{ message: string }>(
                await apiBase(),
                "/v1/auth/reset",
                null,
                { token: token.trim(), password },
              );
              setMessage(result.message);
              setPassword("");
              setToken("");
            }}
          />
          {!!message && <Notice tone="mint">{message}</Notice>}
        </>
      )}
    </Card>
  );
}
