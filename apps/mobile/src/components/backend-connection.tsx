import { useState } from "react";
import { Action, Body, Card, Field, Heading } from "./ui";
import { useTempo } from "../data/store";
export function BackendConnection() {
  const { user, lastSavedAt, pending, reload, updateName, signOut } =
    useTempo();
  const [name, setName] = useState(user?.name || "");
  if (!user) return null;
  return (
    <Card>
      <Heading>{user.name}</Heading>
      <Body>{user.email}</Body>
      <Body>
        {pending
          ? "Saving to your account…"
          : "Your saved plan is stored online in your account."}
      </Body>
      {!!lastSavedAt && (
        <Body small>
          Last checked: {new Date(lastSavedAt).toLocaleString()}
        </Body>
      )}
      <Field label="Your name" value={name} onChangeText={setName} />
      <Action title="Save profile" run={() => updateName(name.trim())} />
      <Action title="Refresh saved plan" run={reload} />
      <Action title="Sign out" run={signOut} />
      <Body small>
        Signing out clears your plan from this app’s memory. Sign back in to
        restore it from your account.
      </Body>
    </Card>
  );
}
