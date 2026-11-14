import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { PasswordRecovery } from "../../components/password-recovery";
import { Brand } from "../../components/brand";
import {
  Icon,
  Notice,
  Reveal,
  Tap,
  fieldLabel,
  inputText,
  type IconName,
} from "../../components/ui";
import { useTempo } from "../../data/store";
import { theme, shadow, gradient, gradients } from "../../design/tokens";

const native = Platform.OS !== "web";

export default function Auth() {
  const { authenticate, signInWithHafrik, initialize, error: sessionError } =
    useTempo();
  const insets = useSafeAreaInsets();
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
  const hafrik = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await signInWithHafrik();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not sign in with Hafrik. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const switchMode = (value: "login" | "register") => {
    setMode(value);
    setError("");
    setPassword("");
    setConfirmation("");
  };
  const longEnough = password.length >= 12;
  const matches = !!confirmation && password === confirmation;
  return (
    <View style={[s.root, gradient(gradients.nightGlow)]}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.page}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.hero}>
              <Reveal>
                <Brand light />
              </Reveal>
              <PlanPreview />
              <Reveal delay={120} style={{ gap: 14 }}>
                <Text accessibilityRole="header" style={s.title}>
                  Tell it all.{"\n"}
                  <Text style={s.titleAccent}>Take it one at a time.</Text>
                </Text>
                <Text style={s.lede}>
                  One voice note or a few words. A realistic plan, made around
                  your life.
                </Text>
              </Reveal>
            </View>
            <Reveal
              delay={220}
              style={[s.sheet, { paddingBottom: 28 + insets.bottom }]}
            >
              <Segmented value={mode} onChange={switchMode} disabled={busy} />
              <View style={{ gap: 6 }}>
                <Text style={s.sheetTitle}>
                  {register ? "Create your account" : "Welcome back"}
                </Text>
                <Text style={s.sheetBody}>
                  {register
                    ? "Your plans follow you, wherever you sign in."
                    : "Sign in to pick up right where you left off."}
                </Text>
              </View>
              <View style={{ gap: 14 }}>
                {register && (
                  <AuthField
                    icon="person"
                    label="Your name"
                    placeholder="Alex Morgan"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    maxLength={80}
                    editable={!busy}
                  />
                )}
                <AuthField
                  icon="mail"
                  label="Email address"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  maxLength={254}
                  editable={!busy}
                />
                <AuthField
                  icon="lock"
                  label="Password"
                  placeholder={register ? "At least 12 characters" : "Your password"}
                  value={password}
                  onChangeText={setPassword}
                  secret
                  autoCapitalize="none"
                  autoComplete={register ? "new-password" : "current-password"}
                  textContentType={register ? "newPassword" : "password"}
                  maxLength={128}
                  editable={!busy}
                  onSubmitEditing={register ? undefined : submit}
                />
                {register && (
                  <>
                    <AuthField
                      icon="lock"
                      label="Confirm password"
                      placeholder="Type it once more"
                      value={confirmation}
                      onChangeText={setConfirmation}
                      secret
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      maxLength={128}
                      editable={!busy}
                      onSubmitEditing={submit}
                    />
                    <View style={s.requirements}>
                      <Requirement met={longEnough} text="12+ characters" />
                      <Requirement met={matches} text="Passwords match" />
                    </View>
                  </>
                )}
              </View>
              {!!(error || sessionError) && (
                <Notice tone="danger">{error || sessionError}</Notice>
              )}
              <Tap
                accessibilityRole="button"
                accessibilityLabel={register ? "Create my account" : "Sign in"}
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={submit}
                style={[s.primary, gradient(gradients.night)]}
              >
                {busy ? (
                  <>
                    <ActivityIndicator color={theme.mint} />
                    <Text style={s.primaryText}>Opening your account…</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.primaryText}>
                      {register ? "Create my account" : "Sign in"}
                    </Text>
                    <View style={[s.primaryArrow, gradient(gradients.accent)]}>
                      <Icon name="arrow" size={18} color={theme.surface} />
                    </View>
                  </>
                )}
              </Tap>
              {native && (
                <>
                  <View style={s.divider}>
                    <View style={s.dividerLine} />
                    <Text style={s.dividerText}>or</Text>
                    <View style={s.dividerLine} />
                  </View>
                  <Tap
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Hafrik"
                    accessibilityState={{ disabled: busy, busy }}
                    disabled={busy}
                    onPress={hafrik}
                    style={s.hafrik}
                  >
                    <Text style={s.hafrikText}>Continue with Hafrik</Text>
                  </Tap>
                </>
              )}
              {!!sessionError && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void initialize()}
                  style={s.secondary}
                >
                  <Icon name="sync" size={17} color={theme.inkSoft} />
                  <Text style={s.secondaryText}>Retry saved session</Text>
                </Pressable>
              )}
              <View style={s.switchRow}>
                <Text style={s.sheetBody}>
                  {register ? "Already have an account?" : "New to Tempo?"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  hitSlop={10}
                  onPress={() => switchMode(register ? "login" : "register")}
                >
                  <Text style={s.switchLink}>
                    {register ? "Sign in" : "Create an account"}
                  </Text>
                </Pressable>
              </View>
              <View style={s.note}>
                <Icon name="cloud" size={16} color={theme.faint} />
                <Text style={s.noteText}>
                  An account is required to use Tempo. Your name, email, tasks,
                  routines, and preferences are saved to your account.
                </Text>
              </View>
              {!register && <PasswordRecovery />}
            </Reveal>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function PlanPreview() {
  const float = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: native,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: native,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);
  const rows: { time: string; title: string; meta: string; color: string }[] =
    [
      {
        time: "09:00",
        title: "Finish the proposal",
        meta: "50 min",
        color: theme.accent,
      },
      {
        time: "12:30",
        title: "Lunch",
        meta: "Protected",
        color: theme.mint,
      },
      {
        time: "14:00",
        title: "Team meeting",
        meta: "Fixed",
        color: "#8FB4FF",
      },
    ];
  return (
    <Reveal delay={60}>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          s.preview,
          {
            transform: [
              {
                translateY: float.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -6],
                }),
              },
            ],
          },
        ]}
      >
        <View style={s.previewHeader}>
          <View style={s.previewDot} />
          <Text style={s.previewKicker}>YOUR DAY · 3 THINGS</Text>
          <View style={{ flex: 1 }} />
          <Icon name="sparkle" size={16} color={theme.mint} />
        </View>
        {rows.map((row, i) => (
          <View
            key={row.time}
            style={[s.previewRow, i === 0 && s.previewRowActive]}
          >
            <Text style={s.previewTime}>{row.time}</Text>
            <View style={[s.previewBar, { backgroundColor: row.color }]} />
            <Text style={s.previewTitle} numberOfLines={1}>
              {row.title}
            </Text>
            <Text style={s.previewMeta}>{row.meta}</Text>
          </View>
        ))}
      </Animated.View>
    </Reveal>
  );
}

function Segmented({
  value,
  onChange,
  disabled,
}: {
  value: "login" | "register";
  onChange: (v: "login" | "register") => void;
  disabled: boolean;
}) {
  const [width, setWidth] = useState(0);
  const x = useState(() => new Animated.Value(value === "register" ? 0 : 1))[0];
  useEffect(() => {
    Animated.spring(x, {
      toValue: value === "register" ? 0 : 1,
      useNativeDriver: native,
      speed: 18,
      bounciness: 4,
    }).start();
  }, [value, x]);
  const half = (width - 8) / 2;
  return (
    <View
      accessibilityRole="tablist"
      style={s.segment}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Animated.View
          style={[
            s.thumb,
            {
              width: half,
              transform: [
                {
                  translateX: x.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, half],
                  }),
                },
              ],
            },
          ]}
        />
      )}
      {(["register", "login"] as const).map((option) => (
        <Pressable
          key={option}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option, disabled }}
          disabled={disabled}
          onPress={() => onChange(option)}
          style={s.segmentItem}
        >
          <Text
            style={[
              s.segmentText,
              value === option && { color: theme.ink, fontFamily: theme.fonts.bold },
            ]}
          >
            {option === "register" ? "Create account" : "Sign in"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function AuthField({
  label,
  icon,
  secret = false,
  ...props
}: {
  label: string;
  icon: IconName;
  secret?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: 8 }}>
      <Text style={fieldLabel}>{label}</Text>
      <View style={[s.field, focused && s.fieldFocused]}>
        <Icon name={icon} size={19} color={focused ? theme.ink : theme.faint} />
        <TextInput
          {...props}
          accessibilityLabel={label}
          autoCorrect={false}
          secureTextEntry={secret && hidden}
          placeholderTextColor={theme.faint}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={inputText}
        />
        {secret && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}
            style={{ padding: 4 }}
          >
            <Icon
              name={hidden ? "eye" : "eyeOff"}
              size={19}
              color={theme.muted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Requirement({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon
        name={met ? "checkCircle" : "circle"}
        size={16}
        color={met ? theme.mintDeep : theme.faint}
      />
      <Text
        style={{
          fontFamily: theme.fonts.medium,
          fontSize: 12.5,
          color: met ? theme.mintDeep : theme.muted,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.night },
  page: {
    flexGrow: 1,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  hero: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 30, gap: 28 },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: -0.8,
    color: theme.surface,
  },
  titleAccent: { fontFamily: theme.fonts.displayItalic, color: theme.mint },
  lede: {
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: theme.darkMuted,
    maxWidth: 360,
  },
  preview: {
    padding: 14,
    gap: 6,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  previewDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.mint,
  },
  previewKicker: {
    fontFamily: theme.fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.3,
    color: theme.darkMuted,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    height: 46,
    borderRadius: 14,
  },
  previewRowActive: { backgroundColor: "rgba(255,255,255,0.08)" },
  previewTime: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.darkMuted,
    width: 42,
  },
  previewBar: { width: 3, height: 22, borderRadius: 2 },
  previewTitle: {
    flex: 1,
    fontFamily: theme.fonts.semibold,
    fontSize: 14.5,
    color: theme.surface,
  },
  previewMeta: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    color: theme.darkMuted,
  },
  sheet: {
    flexGrow: 1,
    backgroundColor: theme.surface,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 22,
    paddingTop: 22,
    gap: 22,
    ...shadow.lifted,
  },
  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 16,
    backgroundColor: theme.background,
  },
  thumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 12,
    backgroundColor: theme.surface,
    ...shadow.soft,
  },
  segmentItem: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.muted,
  },
  sheetTitle: {
    fontFamily: theme.fonts.display,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.4,
    color: theme.ink,
  },
  sheetBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: theme.muted,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 16,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: theme.background,
  },
  fieldFocused: { borderColor: theme.ink, backgroundColor: theme.surface },
  requirements: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    paddingHorizontal: 4,
  },
  primary: {
    minHeight: 60,
    borderRadius: 30,
    paddingLeft: 26,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: theme.night,
    ...shadow.lifted,
  },
  primaryText: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.surface,
    letterSpacing: -0.2,
  },
  primaryArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accent,
  },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.line },
  dividerText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 13,
    color: theme.faint,
  },
  hafrik: {
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  hafrikText: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    color: theme.ink,
    letterSpacing: -0.2,
  },
  secondary: {
    minHeight: 44,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.inkSoft,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  switchLink: {
    fontFamily: theme.fonts.bold,
    fontSize: 14.5,
    color: theme.accent,
  },
  note: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: theme.line,
  },
  noteText: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 12.5,
    lineHeight: 19,
    color: theme.muted,
  },
});
