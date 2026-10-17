import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand } from "../../components/brand";
import { useTempo } from "../../data/store";
import { theme } from "../../design/tokens";
export default function Auth() {
  const { authenticate, initialize, error: sessionError } = useTempo();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const register = mode === "register";
  const submit = async () => {
    if (lock.current) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || email.trim().length > 254) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setError("Use a password with 12–128 characters.");
      return;
    }
    if (register && (!name.trim() || name.trim().length > 80)) {
      setError("Enter your name (up to 80 characters).");
      return;
    }
    if (register && password !== confirmation) {
      setError("Your passwords don’t match.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await authenticate(mode, {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      setPassword("");
      setConfirmation("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not open your account. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.page}
        >
          <Brand large />
          <View style={{ gap: 12, marginTop: 12 }}>
            <Text style={s.kicker}>YOUR DAY, A LITTLE CLEARER</Text>
            <Text accessibilityRole="header" style={s.title}>
              {register ? "Your day starts here." : "Welcome back."}
            </Text>
            <Text style={s.body}>
              One voice note or a few words. A realistic plan, made around your
              life.
            </Text>
          </View>
          <View style={s.hero}>
            <Text style={s.heroTitle}>Tell it all. Take it one at a time.</Text>
            <Text style={s.heroBody}>
              Your plans stay with your account, wherever you sign in.
            </Text>
          </View>
          <View style={s.form}>
            <View style={s.tabs}>
              {(["register", "login"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{
                    selected: mode === value,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => {
                    setMode(value);
                    setError("");
                    setPassword("");
                    setConfirmation("");
                  }}
                  style={[
                    s.tab,
                    mode === value && { backgroundColor: theme.ink },
                  ]}
                >
                  <Text
                    style={[
                      s.tabText,
                      mode === value && { color: theme.surface },
                    ]}
                  >
                    {value === "register" ? "Create account" : "Sign in"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {register && (
              <Field
                label="Your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                maxLength={80}
                editable={!busy}
              />
            )}
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              maxLength={254}
              editable={!busy}
            />
            <Field
              label="Password · 12+ characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={register ? "new-password" : "current-password"}
              maxLength={128}
              editable={!busy}
            />
            {register && (
              <Field
                label="Confirm password"
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                maxLength={128}
                editable={!busy}
              />
            )}
            {!!(error || sessionError) && (
              <Text accessibilityRole="alert" style={s.error}>
                {error || sessionError}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={submit}
              style={[s.primary, busy && { opacity: 0.6 }]}
            >
              <Text style={s.primaryText}>
                {busy
                  ? "Opening your account…"
                  : register
                    ? "Create my account →"
                    : "Sign in →"}
              </Text>
            </Pressable>
            {!!sessionError && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void initialize()}
                style={s.secondary}
              >
                <Text style={s.tabText}>Retry saved session</Text>
              </Pressable>
            )}
            <Text style={s.note}>
              An account is required to use Tempo. Your name, email, tasks,
              routines, and preferences are saved to your account.
            </Text>
          </View>
          <Text style={s.footer}>A clear plan. Room to breathe.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        autoCorrect={false}
        placeholderTextColor={theme.muted}
        style={s.input}
      />
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  page: {
    padding: 24,
    paddingBottom: 40,
    gap: 24,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  kicker: {
    fontFamily: theme.fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.accent,
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 36,
    lineHeight: 42,
    color: theme.ink,
    letterSpacing: -1.1,
  },
  body: {
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    lineHeight: 25,
    color: theme.muted,
  },
  hero: { padding: 22, gap: 10, borderRadius: 24, backgroundColor: theme.ink },
  heroTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 23,
    lineHeight: 30,
    color: theme.surface,
  },
  heroBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: theme.darkMuted,
  },
  form: {
    padding: 20,
    gap: 17,
    borderRadius: 24,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  tabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    backgroundColor: theme.background,
  },
  tab: { flex: 1, padding: 12, borderRadius: 9, alignItems: "center" },
  tabText: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.ink },
  label: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.ink },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    color: theme.ink,
    backgroundColor: theme.background,
  },
  primary: {
    minHeight: 54,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accent,
  },
  primaryText: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.ink },
  secondary: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  error: {
    fontFamily: theme.fonts.regular,
    color: theme.danger,
    lineHeight: 22,
  },
  note: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: theme.muted,
  },
  footer: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    textAlign: "center",
    color: theme.muted,
  },
});
