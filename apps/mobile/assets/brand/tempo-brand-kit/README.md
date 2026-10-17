# Tempo brand kit

The mark combines a lowercase **t**, a gently rising path, and a mint morning sun: one busy mind becoming one clear day.

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
| Navy | `#17202A` | Icon background, primary type |
| Coral | `#E86A4A` | Mark, primary accent |
| Mint | `#B9E6D3` | Sun, progress, calm highlights |
| Warm background | `#F5F5F0` | App surfaces |
| White | `#FFFFFF` | Cards and contrast |

The app uses its existing Inter Regular and Bold font files. Keep the logo lowercase. Leave clear space around the symbol, avoid stretching, and use the same palette across onboarding, settings, and marketing.

## Native integration

`apps/mobile/app.json` references these assets for the app icon, favicon, Android adaptive/themed foregrounds, and the light splash background. Native icon and splash changes require a new app build. A development build does not fully reproduce release splash behavior.
