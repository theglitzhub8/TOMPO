import { Platform, type ViewStyle } from "react-native";

// Tempo "Momentum": cool bright paper, deep night ink, electric blue means
// do it now, orange means urgent, green means done.
export const theme = {
  background: "#F2F4FA",
  surface: "#FFFFFF",
  surfaceMuted: "#E9ECF5",
  darkSurface: "#0F1120",
  night: "#0F1120",
  nightRaised: "#1B1E35",
  ink: "#11131D",
  inkSoft: "#343A4F",
  muted: "#646A80",
  faint: "#A3A8BA",
  accent: "#2B57FF",
  accentDeep: "#1C3FD6",
  accentSoft: "#E4EAFF",
  violet: "#7B4DFF",
  sun: "#FF6B1A",
  sunSoft: "#FFE9DB",
  line: "rgba(17,19,29,0.08)",
  lineStrong: "rgba(17,19,29,0.14)",
  danger: "#E5484D",
  dangerSoft: "#FDE4E4",
  mint: "#7FE0B8",
  mintDeep: "#0E9F6E",
  mintSoft: "#DDF6EC",
  progress: "#13B07B",
  darkTrack: "rgba(255,255,255,0.14)",
  darkLine: "rgba(255,255,255,0.12)",
  darkMuted: "#A9B0CC",
  callAvatar: "#262A45",
  callAccept: "#13B07B",
  radius: 22,
  heroRadius: 30,
  space: 16,
  typography: { title: 40, heading: 19, body: 15, label: 11 },
  fonts: {
    regular: "Jakarta-Regular",
    medium: "Jakarta-Medium",
    semibold: "Jakarta-SemiBold",
    bold: "Jakarta-Bold",
    heavy: "Jakarta-ExtraBold",
    display: "Serif-Regular",
    displayItalic: "Serif-Italic",
    icons: "TempoIcons",
  },
};

export const fontAssets = {
  "Jakarta-Regular": require("../../assets/fonts/PlusJakartaSans_400Regular.ttf"),
  "Jakarta-Medium": require("../../assets/fonts/PlusJakartaSans_500Medium.ttf"),
  "Jakarta-SemiBold": require("../../assets/fonts/PlusJakartaSans_600SemiBold.ttf"),
  "Jakarta-Bold": require("../../assets/fonts/PlusJakartaSans_700Bold.ttf"),
  "Jakarta-ExtraBold": require("../../assets/fonts/PlusJakartaSans_800ExtraBold.ttf"),
  "Serif-Regular": require("../../assets/fonts/InstrumentSerif_400Regular.ttf"),
  "Serif-Italic": require("../../assets/fonts/InstrumentSerif_400Regular_Italic.ttf"),
  TempoIcons: require("../../assets/fonts/TempoIcons.ttf"),
};

// Layered, soft elevation. Native and web both read the CSS box-shadow syntax.
export const shadow = {
  soft: {
    boxShadow:
      "0px 1px 2px rgba(17,19,29,0.04), 0px 8px 24px rgba(17,19,29,0.06)",
  } as ViewStyle,
  lifted: {
    boxShadow:
      "0px 2px 6px rgba(17,19,29,0.06), 0px 18px 40px rgba(17,19,29,0.12)",
  } as ViewStyle,
  glow: {
    boxShadow: "0px 10px 28px rgba(43,87,255,0.32)",
  } as ViewStyle,
};

// CSS gradients: native reads experimental_backgroundImage, web reads backgroundImage.
// Callers always set a solid backgroundColor as the fallback.
export function gradient(css: string): ViewStyle {
  return (
    Platform.OS === "web"
      ? { backgroundImage: css }
      : { experimental_backgroundImage: css }
  ) as ViewStyle;
}

export const gradients = {
  night:
    "linear-gradient(160deg, #1E2140 0%, #0F1120 60%, #0A0B16 100%)",
  nightGlow:
    "radial-gradient(circle at 90% 0%, rgba(123,77,255,0.45) 0%, rgba(123,77,255,0) 45%), radial-gradient(circle at 0% 100%, rgba(43,87,255,0.35) 0%, rgba(43,87,255,0) 50%), linear-gradient(165deg, #1E2140 0%, #0F1120 60%, #0A0B16 100%)",
  accent: "linear-gradient(135deg, #4A72FF 0%, #2B57FF 50%, #5B3DF0 100%)",
  /** The "do it now" block: bright blue with a soft highlight. */
  now: "radial-gradient(circle at 90% 0%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 40%), linear-gradient(150deg, #3A63FF 0%, #2B57FF 45%, #5B3DF0 100%)",
  orb: "radial-gradient(circle at 30% 30%, #A9BEFF 0%, #2B57FF 45%, #7B4DFF 100%)",
  mint: "linear-gradient(135deg, #DDF6EC 0%, #9BE6C6 100%)",
  sun: "linear-gradient(135deg, #FF8A3D 0%, #FF6B1A 100%)",
  paper: "linear-gradient(180deg, #F6F8FD 0%, #F2F4FA 100%)",
};
