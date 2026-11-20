// Public pages the App Store links to: the privacy policy and support.
// The contact address comes from TEMPO_SUPPORT_EMAIL.

const updated = "20 November 2026";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Tempo</title>
<style>
:root { --bg: #F2F4FA; --card: #FFFFFF; --ink: #11131D; --muted: #646A80; --blue: #2B57FF; --line: rgba(17,19,29,0.1); }
@media (prefers-color-scheme: dark) { :root { --bg: #0F1120; --card: #181B30; --ink: #ECEEF6; --muted: #A9B0CC; --blue: #7C97FF; --line: rgba(236,238,246,0.14); } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 40px 20px 72px; }
.mark { width: 44px; height: 44px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #A9BEFF 0%, #2B57FF 45%, #7B4DFF 100%); }
h1 { font-size: 36px; line-height: 1.15; margin: 18px 0 4px; letter-spacing: -0.02em; }
h2 { font-size: 19px; margin: 32px 0 6px; }
p, li { color: var(--ink); }
.muted { color: var(--muted); }
ul { padding-left: 20px; }
a { color: var(--blue); }
section { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 4px 20px 16px; margin-top: 16px; }
</style>
</head>
<body><main><div class="mark" aria-hidden="true"></div>${body}</main></body>
</html>`;
}

function contact() {
  const email = process.env.TEMPO_SUPPORT_EMAIL?.trim();
  return email
    ? `<a href="mailto:${escape(email)}">${escape(email)}</a>`
    : "the support email listed on Tempo’s App Store page";
}

function privacy() {
  return layout(
    "Privacy policy",
    `<h1>Privacy policy</h1>
<p class="muted">Last updated ${updated}</p>
<p>Tempo is a day planner made by The Glitz Hub. This policy explains what Tempo collects, why, who it is shared with, and how to delete it. Tempo has no ads, does not track you across other apps or websites, and does not sell your data.</p>

<h2>What Tempo stores</h2>
<ul>
<li><b>Your account.</b> Your name and email address, and your password stored only as a salted scrypt hash. If you use Login with Hafrik, Tempo stores your Hafrik user ID, name and email; Hafrik passwords and tokens never reach Tempo.</li>
<li><b>Your plans.</b> Tasks and their descriptions, steps, times and deadlines; projects; your regular weekly schedule; preferences such as timezone, quiet hours, how hard Tempo pushes you and the treat you set.</li>
<li><b>Shared work.</b> When you share a task or project, the people you invite can see that task’s title, time, length, steps and status, plus comments and your first name. Your other tasks stay private.</li>
<li><b>Notifications.</b> A push token for your device, so Tempo can tell you when a teammate changes shared work. Task reminders are scheduled on your phone.</li>
</ul>

<h2>Voice and AI</h2>
<ul>
<li><b>Speech.</b> When you talk to Tempo, your phone’s speech recognition service (Apple on iPhone, Google on Android) turns your voice into text. Tempo receives only the text. It never records or stores audio.</li>
<li><b>AI planning.</b> When you use Tell Tempo or Talk to Tempo, the words you send, a list of your current tasks and weekly schedule, and your timezone are sent to Moonshot AI (Kimi) to create the plan or reply. Moonshot AI processes it to answer your request. Tempo does not use it for advertising.</li>
</ul>

<h2>On your phone only</h2>
<ul>
<li><b>Calendar.</b> If you allow it, Tempo reads your calendar on your phone so you can pick events to add. Only the events you choose are saved as tasks.</li>
<li><b>Location.</b> This version of Tempo does not collect your location. If a future version uses it for weather, it will ask first and this policy will be updated.</li>
</ul>

<h2>Where it is kept and how it is protected</h2>
<p>Your data is stored on Tempo’s servers so it follows your account across devices. Connections use HTTPS, sessions use random tokens stored only as hashes, and each account can only read its own data.</p>

<h2>Keeping and deleting your data</h2>
<p>Tempo keeps your data while you have an account. To delete it, open Tempo, go to <b>Me → Delete account</b> and confirm. This immediately deletes your account and everything in it from Tempo’s database, including tasks, projects, your weekly schedule, shares, comments and push tokens. Copies in server backups are removed as those backups expire. You can also ask us to delete your account by contacting ${contact()}.</p>

<h2>Children</h2>
<p>Tempo is not meant for children under 13, and we do not knowingly collect their data.</p>

<h2>Changes</h2>
<p>If this policy changes, the date at the top changes and important changes are announced in the app.</p>

<h2>Contact</h2>
<p>Questions about privacy: ${contact()}.</p>`,
  );
}

function support() {
  return layout(
    "Support",
    `<h1>Tempo support</h1>
<p class="muted">Help with your planner. Contact us at ${contact()}; please include the email you sign in with and what you were doing when something went wrong.</p>
<section>
<h2>I forgot my password</h2>
<p>On the sign-in screen, tap <b>Forgot password?</b> and follow the link in the email. If you signed up with Hafrik, use <b>Continue with Hafrik</b>.</p>
</section>
<section>
<h2>Reminders don’t arrive</h2>
<p>Open <b>Me → Task reminders</b> and turn them on. If they’re blocked, allow notifications for Tempo in your phone’s Settings. Reminders are quiet during your quiet hours, except the start of a task you scheduled.</p>
</section>
<section>
<h2>Voice isn’t working</h2>
<p>Allow microphone and speech recognition for Tempo in your phone’s Settings. Speech recognition may need an internet connection. You can always type instead.</p>
</section>
<section>
<h2>My plan looks different on another device</h2>
<p>Your plan follows your account. Open <b>Me → Refresh saved plan</b>, and make sure both devices are signed in to the same account.</p>
</section>
<section>
<h2>Delete my account</h2>
<p>Open <b>Me → Delete account</b> and type DELETE. Everything is removed from Tempo’s servers. See the <a href="/privacy">privacy policy</a> for details.</p>
</section>`,
  );
}

/** HTML for a public page, or null when the path isn't one. */
export function publicPage(path: string) {
  if (path === "/privacy") return privacy();
  if (path === "/support") return support();
  return null;
}
