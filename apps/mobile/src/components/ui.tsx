import { useState } from "react";
import { router, usePathname } from "expo-router";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTempo } from "../data/store";
import { BottomBar } from "./navigation";
import { Brand } from "./brand";
import { theme } from "../design/tokens";
export { theme } from "../design/tokens";
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 20,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
    fontFamily: theme.fonts.bold,
    color: theme.ink,
  },
  heading: {
    fontSize: 21,
    lineHeight: 28,
    fontFamily: theme.fonts.bold,
    color: theme.ink,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: theme.fonts.regular,
    color: theme.muted,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 24,
    gap: 16,
  },
  input: {
    borderRadius: 12,
    padding: 13,
    minHeight: 52,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    color: theme.ink,
    fontSize: 16,
    fontFamily: theme.fonts.regular,
  },
  button: {
    backgroundColor: theme.ink,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 52,
    justifyContent: "center",
  },
  buttonText: {
    color: theme.surface,
    fontSize: 15,
    fontFamily: theme.fonts.bold,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  error: { color: theme.danger, fontSize: 15, fontFamily: theme.fonts.regular },
  badge: { color: theme.accent, fontSize: 12, fontFamily: theme.fonts.bold },
});
export function Screen({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const timezone = useTempo((s) => s.preferences.timezone);
  const cloudError = useTempo((s) => (s.user ? s.error : null));
  const detail = [
    "/onboarding",
    "/reports",
    "/notification-test",
    "/health",
  ].includes(pathname);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  })
    .format(new Date())
    .replace(",", " ·")
    .toUpperCase();
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
                paddingHorizontal: 2,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  detail ? "Back to workspace" : "Open settings"
                }
                onPress={() =>
                  detail
                    ? router.canGoBack()
                      ? router.back()
                      : router.navigate("/")
                    : router.navigate("/settings")
                }
                hitSlop={12}
              >
                <Brand />
              </Pressable>
              <Text
                style={{
                  fontFamily: theme.fonts.regular,
                  fontSize: 12,
                  width: 110,
                  color: theme.muted,
                }}
              >
                {date}
              </Text>
            </View>
            <View style={{ gap: 12, paddingHorizontal: 2, marginBottom: 22 }}>
              {eyebrow && <Text style={styles.badge}>{eyebrow}</Text>}
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              {subtitle && <Text style={styles.body}>{subtitle}</Text>}
            </View>
            {!!cloudError && (
              <Text accessibilityRole="alert" style={styles.error}>
                {cloudError}
              </Text>
            )}
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {detail && <BottomBar />}
    </View>
  );
}
export function Card({
  children,
  dark = false,
  style,
  onPress,
  label,
}: {
  children: React.ReactNode;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  label?: string;
}) {
  const cardStyle = [
    styles.card,
    dark && {
      backgroundColor: theme.darkSurface,
      borderRadius: theme.heroRadius,
    },
    style,
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={cardStyle}
    >
      {children}
    </Pressable>
  ) : (
    <View style={cardStyle}>{children}</View>
  );
}
export function Body({
  children,
  light = false,
  small = false,
}: {
  children: React.ReactNode;
  light?: boolean;
  small?: boolean;
}) {
  return (
    <Text
      style={[
        styles.body,
        small && { fontSize: 12, lineHeight: 14 },
        light && { color: theme.darkMuted },
      ]}
    >
      {children}
    </Text>
  );
}
export function Heading({
  children,
  light = false,
  small = false,
  size,
}: {
  children: React.ReactNode;
  light?: boolean;
  small?: boolean;
  size?: number;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        styles.heading,
        size !== undefined && { fontSize: size, lineHeight: size + 6 },
        small && { fontSize: 17, lineHeight: 23 },
        light && { color: theme.surface },
      ]}
    >
      {children}
    </Text>
  );
}
export function Label({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <Text style={[styles.badge, light && { color: theme.darkMuted }]}>
      {children}
    </Text>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  numeric = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.body}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && { minHeight: 102, textAlignVertical: "top" },
        ]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "number-pad" : "default"}
        autoCapitalize="none"
        multiline={multiline}
      />
    </View>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.button, disabled && { opacity: 0.5 }]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function Action({
  title,
  run,
}: {
  title: string;
  run: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Button
        disabled={busy}
        title={busy ? "Saving…" : title}
        onPress={async () => {
          setBusy(true);
          setError("");
          try {
            await run();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
export function Progress({
  completed,
  total,
  dark = false,
  showLabel = true,
}: {
  completed: number;
  total: number;
  dark?: boolean;
  showLabel?: boolean;
}) {
  const percent = total
    ? Math.min(100, Math.round((completed / total) * 100))
    : 0;
  return (
    <View style={{ gap: 10 }}>
      {showLabel && <Body light={dark}>{percent}% complete</Body>}
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Task completion"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={{
          height: 8,
          borderRadius: 5,
          backgroundColor: dark ? theme.darkTrack : theme.line,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${percent}%`,
            backgroundColor: dark ? theme.progress : theme.accent,
          }}
        />
      </View>
    </View>
  );
}
export function ProgressHero({
  completed,
  total,
  label,
  report = false,
}: {
  completed: number;
  total: number;
  label: string;
  report?: boolean;
}) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return (
    <Card
      dark
      style={{
        minHeight: report ? 230 : 220,
        paddingTop: 25,
        paddingBottom: 30,
        gap: report ? 18 : 8,
      }}
    >
      <View style={{ gap: report ? 16 : 20 }}>
        <Label light>{label}</Label>
        <Text
          style={{
            fontFamily: theme.fonts.bold,
            fontSize: report ? 68 : 64,
            lineHeight: 78,
            color: theme.surface,
          }}
        >
          {percent}%
        </Text>
      </View>
      <Progress completed={completed} total={total} dark showLabel={false} />
    </Card>
  );
}
