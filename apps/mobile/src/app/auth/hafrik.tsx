import { Redirect } from "expo-router";
// Android delivers the tempo://auth/hafrik return link here; the sign-in sheet
// has already handed it to the app, so just go back to the right screen.
export default function HafrikReturn() {
  return <Redirect href="/" />;
}
