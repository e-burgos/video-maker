# spec-e-burgos-003-kinetic-captions cycle-01 — 2026-09-07

## Estado

- Capa de decisión tipográfica y de posicionamiento de los captions, entera como helpers puros:
  `captionPreset` / `CAPTION_PRESETS` (4 looks: `bold-impact`, `clean-sans`, `outline-pop`,
  `subtle-lower`), `captionSafeZone` + `captionChromeInsets` (insets de chrome por plataforma),
  `captionBoxFor` (anclaje `top`/`center`/`bottom`), `fitCaptionFontSize` (ajuste determinista sin
  medir el DOM) y `captionWordStyle` (normal / impacto / activa). `captionFontFaceCss` genera el
  `@font-face` de una fuente propia. CA-001..CA-005 en verde. 189 tests (17 archivos), cobertura
  **96.2 % stmts / 92.38 % ramas / 97.56 % funcs** sobre `src/helpers/**` + `src/transitions/**` —
  sube el piso heredado de cycle-03 (94 % / 87.87 %) en ambos ejes. Suite sigue sin red, sin
  Chrome y sin ffmpeg.
- **Nada del ciclo entra a la Timeline** (D-A): todo lo tipográfico viaja como props con defaults.
  `libs/timeline-core` no se tocó.
- `CaptionTrack` (COMP-003) y `captionLayout` **siguen vigentes y exportados**: su reemplazo por
  `<KineticCaptions />` es cycle-02 (D-D). Todavía no hay componente ni animación.

## Estructura

- Seis helpers nuevos en `src/helpers/`, cada uno con su `*.spec.ts` hermano:
  `caption-preset.ts`, `caption-safe-zone.ts`, `caption-box.ts`, `caption-font-size.ts`,
  `caption-word-style.ts`, `caption-font-face.ts`. Ninguno importa `remotion` — cargan igual en un
  `Player` de browser que en Node.
- Patrón de los presets: **cero píxeles absolutos**. Todo es ratio contra `format.height`
  (`minFontSizeRatio`, `maxFontSizeRatio`, `boxHeightRatio`, `sidePaddingRatio`) o `em` contra el
  `fontSize` del clip (`letterSpacingEm`, `wordGapEm`, `lineHeightEm`, `stroke.widthEm`,
  `pill.*Em`). Un preset se lee igual en 1080×1920 que en 1920×1080.
- Patrón de los insets de plataforma: son **aditivos y nunca reducen** el safe zone base, y se
  escalan por `format.height / reference.height` desde un lienzo de referencia declarado por
  entrada. Una plataforma no soportada degrada a "sin plataforma" (identidad), no tira.
- `captionWordStyle` **no emite `fontSize`** a propósito: lo pone el contenedor del clip una sola
  vez por frase, con `fitCaptionFontSize`. Hay un test que lo fija.
- `public/fonts/` (nuevo, gitignoreado con `*` + `!.gitignore`) es el lugar donde el creador cuelga
  su fuente. `captionFontFaceCss` recibe el `src` ya resuelto — la lib nunca arma rutas ni sale a
  la red.

## Dependencias

Ninguna nueva. Ni el `package.json` de la lib ni el raíz cambiaron: el ciclo usa `react` (solo
`import type { CSSProperties }`), `@video-maker/timeline-core` y `vitest`, todos ya presentes.

## Qué sigue

- **cycle-02** (RF-6..RF-9, CA-006..CA-011): `captionClipAnimation` con `spring`, `activeWordIndex`,
  el componente `<KineticCaptions />`, la galería de presets en `Root.tsx` y el reemplazo de
  `CaptionTrack` — que sale del barrel junto con su registro COMP-003, y ahí hay que revisar el test
  de `caption-safe-zone.spec.ts` que todavía usa `captionLayout` para verificar contención.
- `heightCap` de `fitCaptionFontSize` es hoy inerte (nunca liga con los cuatro presets actuales):
  si un preset nuevo sube `maxFontSizeRatio` o baja `boxHeightRatio`, esa rama pasa a ser el camino
  real.
- `averageCharWidthEm` es estimación, no medición: con la galería de cycle-02 conviene mirar los
  cuatro presets con frases reales antes de darla por buena. Igual los insets de chrome, que son
  valores declarados y no medidos contra capturas de las apps.
