# Tempo brand kit

The mark combines a lowercase **t**, a gently rising path, and a green sun: one busy mind becoming one clear day. Since the Momentum redesign (November 2026) the **t** runs from electric blue to violet and the sun is the green of a finished task.

## Assets

- `tempo-app-icon.png`: opaque square master, navy background. Used for the iOS icon, web favicon, and in-app brand badge. Expo generates platform sizes from this master.
- `tempo-app-icon-1024.png`: ready-to-use 1024 × 1024 iOS/App Store icon, exported by Expo’s native asset pipeline.
- `tempo-favicon.ico`: web favicon exported by Expo.
- `tempo-mark.png`: standalone symbol with alpha transparency. Used for Android adaptive and themed icon masks, and the native splash screen.
- `tempo-logo.png`: horizontal logo on a light background, with the lowercase Tempo wordmark. Used on the sign-up and account-loading screens.
- `PROMPTS.md`: generation prompts and provenance. All artwork was generated with the built-in image generation tool; no external image API credentials were used.

App icon and mark masters are 1254 × 1254 pixels. Preserve their square canvas and clear space; let platform tooling resize and mask them. Do not bake rounded corners into the square icon. The wordmark is for light backgrounds; use the icon or symbol on dark backgrounds.

## Palette and type

| Token | Color | Use |
| --- | --- | --- |
| Night | `#0F1120` | Icon background, splash, dark surfaces |
| Electric blue | `#2B57FF` | The **t**, primary accent: do it now |
| Violet | `#7B4DFF` | Gradient partner to blue, Tempo orb |
| Done green | `#13B07B` | The sun, progress, finished tasks |
| Orange | `#FF6B1A` | Urgent and late |
| Paper | `#F2F4FA` | App background |
| White | `#FFFFFF` | Cards and contrast |

The recolored icon and mark keep the original shapes exactly; `tempo-logo.png` (horizontal wordmark) still uses the earlier coral palette and is not used in the app.

Type: Plus Jakarta Sans (400–800) for interface text, Instrument Serif (regular and italic) for display headlines, and a 7 KB Material Symbols subset (`TempoIcons.ttf`) for icons. All are bundled in `assets/fonts` with their licenses. Keep the logo lowercase. Leave clear space around the symbol, avoid stretching, and use the same palette across onboarding, settings, and marketing.

## Native integration

`apps/mobile/app.json` references these assets for the app icon, favicon, Android adaptive/themed foregrounds, and the light splash background. Native icon and splash changes require a new app build. A development build does not fully reproduce release splash behavior.
