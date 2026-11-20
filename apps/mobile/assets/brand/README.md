# Tempo brand kit

The icon is a bold white lowercase **t** with a green sun, on electric blue fading to violet ("The Spark", chosen November 2026). The t is set in Plus Jakarta Sans ExtraBold, the app's own typeface; the green sun is the colour of a finished task.

## Assets

- `tempo-app-icon.png`: opaque square master, navy background. Used for the iOS icon, web favicon, and in-app brand badge. Expo generates platform sizes from this master.
- `tempo-app-icon-1024.png`: ready-to-use 1024 × 1024 iOS/App Store icon, exported by Expo’s native asset pipeline.
- `tempo-favicon.ico`: web favicon exported by Expo.
- `tempo-mark.png`: standalone symbol with alpha transparency. Used for Android adaptive and themed icon masks, and the native splash screen.
- `tempo-logo.png`: horizontal logo on a light background, with the lowercase Tempo wordmark. Used on the sign-up and account-loading screens.
- `render_brand.py`: renders the icon, mark, favicon and logo from code with the bundled fonts. Edit and re-run it to change the brand images.
- `PROMPTS.md`: prompts for the original coral artwork (October 2026), kept for history.

App icon and mark masters are 1024 × 1024 pixels. Preserve their square canvas and clear space; let platform tooling resize and mask them. Do not bake rounded corners into the square icon. The wordmark is for light backgrounds; use the icon or symbol on dark backgrounds.

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

All brand images are rendered from code (a Python script using the bundled fonts), not generated artwork. `tempo-logo.png` is the horizontal lockup for light backgrounds; it is not used inside the app.

Type: Plus Jakarta Sans (400–800) for interface text, Instrument Serif (regular and italic) for display headlines, and a 7 KB Material Symbols subset (`TempoIcons.ttf`) for icons. All are bundled in `assets/fonts` with their licenses. Keep the logo lowercase. Leave clear space around the symbol, avoid stretching, and use the same palette across onboarding, settings, and marketing.

## Native integration

`apps/mobile/app.json` references these assets for the app icon, favicon, Android adaptive/themed foregrounds, and the light splash background. Native icon and splash changes require a new app build. A development build does not fully reproduce release splash behavior.
