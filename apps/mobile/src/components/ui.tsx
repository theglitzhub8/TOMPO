import { useEffect, useState } from "react";
import { router, usePathname } from "expo-router";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTempo } from "../data/store";
import { BottomBar } from "./navigation";
import { theme, shadow, gradient, gradients } from "../design/tokens";
export { theme } from "../design/tokens";

const native = Platform.OS !== "web";

// Material Symbols codepoints bundled in assets/fonts/TempoIcons.ttf.
const glyphs = {
  home: 0xe88a,
  sparkle: 0xe65f,
  settings: 0xe8b8,
  mic: 0xe029,
  stop: 0xe047,
  arrow: 0xe5c8,
  back: 0xe5c4,
  check: 0xe5ca,
  checkCircle: 0xe86c,
  circle: 0xe836,
  eye: 0xe8f4,
  eyeOff: 0xe8f5,
  mail: 0xe158,
  lock: 0xe897,
  person: 0xe7fd,
  clock: 0xe8b5,
  sync: 0xe627,
  logout: 0xe9ba,
  globe: 0xe80b,
  routine: 0xeb7b,
  list: 0xe6b1,
  chevron: 0xe5cc,
  close: 0xe5cd,
  edit: 0xe3c9,
  bolt: 0xea0b,
  add: 0xe145,
  keyboard: 0xe312,
  wave: 0xe1b8,
  event: 0xe878,
  timer: 0xe425,
  cloud: 0xe2bf,
  error: 0xe000,
  calendar: 0xe935,
  history: 0xe889,
  spa: 0xeb4c,
  tune: 0xe429,
  delete: 0xe872,
  coffee: 0xefef,
  sun: 0xe430,
  moon: 0xe51c,
  redo: 0xe15a,
  doneAll: 0xe877,
  calm: 0xea78,
  folder: 0xe2c7,
  folderOpen: 0xe2c8,
  newFolder: 0xe2cc,
  taskDone: 0xe2e6,
  more: 0xe5d3,
  expand: 0xe5cf,
  collapse: 0xe5ce,
  inbox: 0xe156,
  bell: 0xe7f4,
  bellRing: 0xe7f7,
  bellOff: 0xe7f6,
  send: 0xe163,
} as const;
export type IconName = keyof typeof glyphs;

export function Icon({
  name,
  size = 20,
  color = theme.ink,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      accessible={false}
      importantForAccessibility="no"
      allowFontScaling={false}
      style={[
        {
          fontFamily: theme.fonts.icons,
          fontSize: size,
          lineHeight: size,
          width: size,
          height: size,
          color,
          textAlign: "center",
        },
        style,
      ]}
    >
      {String.fromCodePoint(glyphs[name])}
    </Text>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 16,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
  },
  title: {
    fontSize: 44,
    lineHeight: 48,
    fontFamily: theme.fonts.display,
    color: theme.ink,
    letterSpacing: -0.6,
  },
  heading: {
    fontSize: 19,
    lineHeight: 25,
    fontFamily: theme.fonts.bold,
    color: theme.ink,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: theme.fonts.regular,
    color: theme.muted,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: theme.line,
    ...shadow.soft,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 54,
    backgroundColor: theme.background,
    borderWidth: 1.5,
    borderColor: "transparent",
    color: theme.ink,
    fontSize: 16,
    fontFamily: theme.fonts.medium,
  },
  button: {
    backgroundColor: theme.ink,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 14,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buttonText: {
    color: theme.surface,
    fontSize: 15,
    fontFamily: theme.fonts.semibold,
    letterSpacing: -0.1,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  error: {
    color: theme.danger,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: theme.fonts.medium,
  },
  badge: {
    color: theme.accent,
    fontSize: 11,
    letterSpacing: 1.4,
    fontFamily: theme.fonts.bold,
  },
});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a soft spring scale on touch. */
export function Tap({
  style,
  scale = 0.97,
  children,
  ...props
}: Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  scale?: number;
  children?: React.ReactNode;
}) {
  const value = useState(() => new Animated.Value(1))[0];
  const to = (v: number) =>
    Animated.spring(value, {
      toValue: v,
      useNativeDriver: native,
      speed: 40,
      bounciness: 6,
    }).start();
  return (
    <AnimatedPressable
      {...props}
      style={[style, { transform: [{ scale: value }] }]}
      onPressIn={(e) => {
        to(scale);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        props.onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Gentle entrance: fade and rise, optionally staggered. */
export function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const value = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(value, {
      toValue: 1,
      duration: 520,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [value, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value,
          transform: [
            {
              translateY: value.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/brand/tempo-app-icon.png")}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
    />
  );
}

export function Avatar({
  name,
  size = 40,
  dark = false,
}: {
  name: string;
  size?: number;
  dark?: boolean;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "·";
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: dark ? theme.accent : theme.ink,
        },
        gradient(dark ? gradients.coral : gradients.night),
      ]}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bold,
          fontSize: size * 0.38,
          color: theme.surface,
          letterSpacing: 0.5,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

export function Screen({
  title,
  titleAccent,
  subtitle,
  eyebrow,
  children,
}: {
  title: string;
  titleAccent?: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const timezone = useTempo((s) => s.preferences.timezone);
  const name = useTempo((s) => s.user?.name ?? "");
  const cloudError = useTempo((s) => (s.user ? s.error : null));
  const pending = useTempo((s) => s.pending);
  const lastSavedAt = useTempo(s => s.lastSavedAt);
  const canUndo = useTempo(s => !!s.undoEntry && s.undoEntry.revision === s.revision);
  const detail = ![
    "/",
    "/planning",
    "/settings",
    "/projects",
    "/tasks",
  ].includes(pathname);
  // Tab routes (including hidden ones) already get the bar from the tabs layout.
  const stackRoute = ["/onboarding", "/reports", "/notification-test", "/week", "/team", "/inbox", "/calendar", "/next"].includes(
    pathname,
  );
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());
  return (
    <View style={styles.screen}>
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.screen, gradient(gradients.paper)]}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                minHeight: 48,
              }}
            >
              {detail ? (
                <Tap
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  hitSlop={8}
                  onPress={() =>
                    router.canGoBack() ? router.back() : router.navigate("/")
                  }
                  style={iconButton}
                >
                  <Icon name="back" size={20} />
                </Tap>
              ) : (
                <View
                  accessibilityLabel="Tempo"
                  style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <BrandMark size={32} />
                  <Text
                    style={{
                      fontFamily: theme.fonts.heavy,
                      fontSize: 19,
                      color: theme.ink,
                      letterSpacing: -0.8,
                    }}
                  >
                    tempo
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={datePill}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: pending ? theme.accent : theme.mintDeep,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: theme.fonts.semibold,
                      fontSize: 12,
                      color: theme.inkSoft,
                    }}
                  >
                    {date}
                  </Text>
                </View>
                {!!name && pathname !== "/settings" && (
                  <Tap
                    accessibilityRole="button"
                    accessibilityLabel="Open settings"
                    onPress={() => router.navigate("/settings")}
                    hitSlop={6}
                  >
                    <Avatar name={name} size={38} />
                  </Tap>
                )}
              </View>
            </View>
            <Reveal style={{ gap: 10, marginTop: 18, marginBottom: 10 }}>
              {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
              <Text accessibilityRole="header" style={styles.title}>
                {title}
                {titleAccent && (
                  <Text
                    style={{
                      fontFamily: theme.fonts.displayItalic,
                      color: theme.accent,
                    }}
                  >
                    {" "}
                    {titleAccent}
                  </Text>
                )}
              </Text>
              {subtitle && (
                <Text style={[styles.body, { fontSize: 16, lineHeight: 24 }]}>
                  {subtitle}
                </Text>
              )}
            </Reveal>
            {!!cloudError && <Notice tone="danger">{cloudError}</Notice>}
            {!!name && <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Body small>{pending ? "Saving online…" : cloudError ? "Changes need attention" : lastSavedAt ? "Saved online" : "Ready"}</Body>
              {canUndo && !pending && <Action title="Undo last edit" variant="ghost" compact run={() => useTempo.getState().undo()} />}
            </View>}
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {stackRoute && <BottomBar />}
    </View>
  );
}

const iconButton: ViewStyle = {
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.surface,
  borderWidth: 1,
  borderColor: theme.line,
  ...shadow.soft,
};
const datePill: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 7,
  paddingHorizontal: 12,
  height: 34,
  borderRadius: 17,
  backgroundColor: theme.surface,
  borderWidth: 1,
  borderColor: theme.line,
};

export function Eyebrow({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        style={{
          width: 14,
          height: 2,
          borderRadius: 1,
          backgroundColor: light ? theme.mint : theme.accent,
        }}
      />
      <Text style={[styles.badge, light && { color: theme.mint }]}>
        {children}
      </Text>
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
    dark && [
      {
        backgroundColor: theme.night,
        borderRadius: theme.heroRadius,
        borderColor: theme.darkLine,
        overflow: "hidden" as const,
        ...shadow.lifted,
      },
      gradient(gradients.nightGlow),
    ],
    style,
  ];
  return onPress ? (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scale={0.985}
      style={cardStyle}
    >
      {children}
    </Tap>
  ) : (
    <View style={cardStyle}>{children}</View>
  );
}

export function Body({
  children,
  light = false,
  small = false,
  style,
}: {
  children: React.ReactNode;
  light?: boolean;
  small?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        styles.body,
        small && { fontSize: 13, lineHeight: 19 },
        light && { color: theme.darkMuted },
        style,
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
  serif = false,
}: {
  children: React.ReactNode;
  light?: boolean;
  small?: boolean;
  size?: number;
  serif?: boolean;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        styles.heading,
        serif && {
          fontFamily: theme.fonts.display,
          fontSize: 30,
          lineHeight: 34,
          letterSpacing: -0.3,
        },
        size !== undefined && { fontSize: size, lineHeight: size * 1.15 },
        small && { fontSize: 16, lineHeight: 22 },
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
    <Text style={[styles.badge, light && { color: theme.mint }]}>
      {children}
    </Text>
  );
}

export function Chip({
  icon,
  children,
  tone = "neutral",
}: {
  icon?: IconName;
  children: React.ReactNode;
  tone?: "neutral" | "dark" | "accent" | "mint";
}) {
  const palette = {
    neutral: { bg: theme.surfaceMuted, fg: theme.inkSoft },
    dark: { bg: "rgba(255,255,255,0.09)", fg: theme.surface },
    accent: { bg: theme.accentSoft, fg: theme.accentDeep },
    mint: { bg: theme.mintSoft, fg: theme.mintDeep },
  }[tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 6,
        minHeight: 30,
        maxWidth: "100%",
        borderRadius: 15,
        backgroundColor: palette.bg,
        alignSelf: "flex-start",
      }}
    >
      {icon && <Icon name={icon} size={15} color={palette.fg} />}
      <Text
        style={{
          flexShrink: 1,
          fontFamily: theme.fonts.semibold,
          fontSize: 12.5,
          lineHeight: 17,
          color: palette.fg,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function Notice({
  children,
  tone = "accent",
  icon,
}: {
  children: React.ReactNode;
  tone?: "accent" | "mint" | "danger";
  icon?: IconName;
}) {
  const palette = {
    accent: { bg: theme.accentSoft, fg: theme.accentDeep, i: "sparkle" },
    mint: { bg: theme.mintSoft, fg: theme.mintDeep, i: "checkCircle" },
    danger: { bg: theme.dangerSoft, fg: theme.danger, i: "error" },
  }[tone];
  return (
    <Reveal
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 16,
        borderRadius: 18,
        backgroundColor: palette.bg,
        alignItems: "flex-start",
      }}
    >
      <Icon name={icon ?? (palette.i as IconName)} size={20} color={palette.fg} />
      <Text
        accessibilityRole={tone === "danger" ? "alert" : undefined}
        style={{
          flex: 1,
          fontFamily: theme.fonts.medium,
          fontSize: 14,
          lineHeight: 21,
          color: palette.fg,
        }}
      >
        {children}
      </Text>
    </Reveal>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  numeric = false,
  multiline = false,
  secure = false,
  icon,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
  multiline?: boolean;
  secure?: boolean;
  icon?: IconName;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={fieldLabel}>{label}</Text>
      <View
        style={[
          styles.input,
          {
            flexDirection: "row",
            alignItems: multiline ? "flex-start" : "center",
            gap: 10,
            paddingVertical: 0,
          },
          focused && {
            borderColor: theme.ink,
            backgroundColor: theme.surface,
          },
        ]}
      >
        {icon && (
          <Icon
            name={icon}
            size={19}
            color={focused ? theme.ink : theme.faint}
            style={multiline ? { marginTop: 16 } : undefined}
          />
        )}
        <TextInput
          accessibilityLabel={label}
          secureTextEntry={secure}
          autoCorrect={secure ? false : undefined}
          style={[
            inputText,
            multiline && {
              minHeight: 102,
              textAlignVertical: "top",
              paddingTop: 15,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={numeric ? "number-pad" : "default"}
          autoCapitalize="none"
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor={theme.faint}
        />
      </View>
    </View>
  );
}
export const fieldLabel: TextStyle = {
  fontFamily: theme.fonts.semibold,
  fontSize: 13,
  color: theme.inkSoft,
  marginLeft: 4,
};
export const inputText: TextStyle = {
  flex: 1,
  minHeight: 52,
  paddingVertical: 14,
  fontFamily: theme.fonts.medium,
  fontSize: 16,
  color: theme.ink,
  ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : {}),
};

export type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "ghost"
  | "light"
  | "danger";

const variants: Record<
  ButtonVariant,
  { box: StyleProp<ViewStyle>; text: string }
> = {
  primary: { box: { backgroundColor: theme.ink }, text: theme.surface },
  accent: {
    box: [
      { backgroundColor: theme.accent, ...shadow.glow },
      gradient(gradients.coral),
    ],
    text: theme.surface,
  },
  secondary: {
    box: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.lineStrong,
    },
    text: theme.ink,
  },
  ghost: { box: { backgroundColor: "transparent" }, text: theme.inkSoft },
  light: { box: { backgroundColor: theme.surface }, text: theme.ink },
  danger: { box: { backgroundColor: theme.dangerSoft }, text: theme.danger },
};

export function Button({
  title,
  onPress,
  disabled = false,
  variant = "primary",
  icon,
  trailingIcon,
  compact = false,
  style,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  variant?: ButtonVariant;
  icon?: IconName;
  trailingIcon?: IconName;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = variants[variant];
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[
        styles.button,
        v.box,
        compact && { minHeight: 44, paddingVertical: 9, paddingHorizontal: 16 },
        disabled && { opacity: 0.4 },
        style,
      ]}
      onPress={onPress}
    >
      {icon && <Icon name={icon} size={compact ? 17 : 19} color={v.text} />}
      <Text
        style={[
          styles.buttonText,
          { color: v.text, flexShrink: 1, textAlign: "center" },
          compact && { fontSize: 13.5 },
        ]}
      >
        {title}
      </Text>
      {trailingIcon && (
        <Icon name={trailingIcon} size={compact ? 17 : 19} color={v.text} />
      )}
    </Tap>
  );
}

export function Action({
  title,
  run,
  variant,
  icon,
  trailingIcon,
  compact,
  busyTitle = "Saving…",
  style,
}: {
  title: string;
  run: () => Promise<void>;
  variant?: ButtonVariant;
  icon?: IconName;
  trailingIcon?: IconName;
  compact?: boolean;
  busyTitle?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <View style={[{ gap: 8 }, style]}>
      <Button
        disabled={busy}
        title={busy ? busyTitle : title}
        variant={variant}
        icon={icon}
        trailingIcon={busy ? undefined : trailingIcon}
        compact={compact}
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

/** Grouped settings-style list. */
export function Group({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      {title && (
        <Text
          style={{
            fontFamily: theme.fonts.bold,
            fontSize: 11,
            letterSpacing: 1.4,
            color: theme.muted,
            marginLeft: 6,
          }}
        >
          {title}
        </Text>
      )}
      <View style={[styles.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
        {children}
      </View>
    </View>
  );
}

export function ListRow({
  icon,
  title,
  detail,
  onPress,
  tint = theme.ink,
  last = false,
  trailing,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  onPress?: () => void;
  tint?: string;
  last?: boolean;
  trailing?: React.ReactNode;
}) {
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 18,
        paddingVertical: 15,
        minHeight: 64,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.line,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.background,
        }}
      >
        <Icon name={icon} size={19} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: theme.fonts.semibold,
            fontSize: 15,
            color: tint,
          }}
        >
          {title}
        </Text>
        {detail && (
          <Text
            style={{
              fontFamily: theme.fonts.regular,
              fontSize: 13,
              lineHeight: 18,
              color: theme.muted,
            }}
          >
            {detail}
          </Text>
        )}
      </View>
      {trailing ??
        (onPress && <Icon name="chevron" size={20} color={theme.faint} />)}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => pressed && { backgroundColor: theme.background }}
    >
      {content}
    </Pressable>
  ) : (
    content
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
  const width = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(width, {
      toValue: percent,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent, width]);
  return (
    <View style={{ gap: 10 }}>
      {showLabel && <Body light={dark}>{percent}% complete</Body>}
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Task completion"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: dark ? theme.darkTrack : theme.surfaceMuted,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[
            {
              height: "100%",
              borderRadius: 4,
              width: width.interpolate({
                inputRange: [0, 100],
                outputRange: ["0%", "100%"],
              }),
              backgroundColor: dark ? theme.mint : theme.accent,
            },
            gradient(dark ? gradients.mint : gradients.coral),
          ]}
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
        paddingTop: 26,
        paddingBottom: 30,
        gap: report ? 18 : 10,
      }}
    >
      <View style={{ gap: report ? 14 : 18 }}>
        <Eyebrow light>{label}</Eyebrow>
        <Text
          style={{
            fontFamily: theme.fonts.display,
            fontSize: 84,
            lineHeight: 88,
            color: theme.surface,
            letterSpacing: -1,
          }}
        >
          {percent}
          <Text style={{ fontFamily: theme.fonts.displayItalic, color: theme.mint }}>
            %
          </Text>
        </Text>
      </View>
      <Progress completed={completed} total={total} dark showLabel={false} />
    </Card>
  );
}
