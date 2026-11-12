import { Platform, type ViewStyle } from "react-native";

// Tempo visual system: warm paper, deep night ink, coral energy, mint calm.
export const theme = {
  background: "#F4F2EC",
  surface: "#FFFFFF",
  surfaceMuted: "#EDEAE2",
  darkSurface: "#0F1A24",
  night: "#0F1A24",
  nightRaised: "#1A2833",
  ink: "#0F1A24",
  inkSoft: "#38444E",
  muted: "#77807C",
  faint: "#A9AEAA",
  accent: "#E86A4A",
  accentDeep: "#C9502F",
  accentSoft: "#FBE6DC",
  line: "rgba(15,26,36,0.08)",
  lineStrong: "rgba(15,26,36,0.14)",
  danger: "#C94A4A",
  dangerSoft: "#F8E1DF",
  mint: "#B9E6D3",
  mintDeep: "#2E8B67",
  mintSoft: "#E3F4EC",
  progress: "#B9E6D3",
  darkTrack: "rgba(255,255,255,0.12)",
  darkLine: "rgba(255,255,255,0.10)",
  darkMuted: "#A9B7BA",
  callAvatar: "#2C3941",
  callAccept: "#B9E6D3",
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
      "0px 1px 2px rgba(15,26,36,0.04), 0px 8px 24px rgba(15,26,36,0.06)",
  } as ViewStyle,
  lifted: {
    boxShadow:
      "0px 2px 6px rgba(15,26,36,0.06), 0px 18px 40px rgba(15,26,36,0.12)",
  } as ViewStyle,
  glow: {
    boxShadow: "0px 10px 30px rgba(232,106,74,0.35)",
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
    "linear-gradient(160deg, #1D2E3A 0%, #0F1A24 55%, #0B131B 100%)",
  nightGlow:
    "radial-gradient(circle at 85% 0%, rgba(232,106,74,0.45) 0%, rgba(232,106,74,0) 45%), radial-gradient(circle at 0% 100%, rgba(185,230,211,0.22) 0%, rgba(185,230,211,0) 50%), linear-gradient(165deg, #1D2E3A 0%, #0F1A24 60%, #0B131B 100%)",
  coral: "linear-gradient(135deg, #F08463 0%, #E86A4A 50%, #D4532F 100%)",
  mint: "linear-gradient(135deg, #D2F0E2 0%, #B9E6D3 100%)",
  paper: "linear-gradient(180deg, #F7F5F0 0%, #F4F2EC 100%)",
};
