# spec-e-burgos-003 cycle-02 — 2026-09-07

## Estado

- Kinetic captions completos y cableados: `<KineticCaptions />` monta una `Sequence` por clip de
  `tracks.captions` con `from`/`durationInFrames` exactos, anima entrada y salida del bloque con
  `spring` y resalta la palabra activa por frame. Cierra la spec `spec-e-burgos-003` (CA-006..CA-011).
- `TimelineComposition` monta `KineticCaptions` y acepta `captionPreset` / `captionPlatform` /
  `captionAnchor` como props. `calculateTimelineMetadata` ahora devuelve `props: { ...props,
  timeline }` — sin ese spread las props de caption se borraban en silencio.
- **resuelve** el pendiente que dejaba `spec-e-burgos-003 cycle-01` (`## Qué sigue`): `CaptionTrack`
  y `captionLayout` ya **no existen** — se eliminaron `src/components/caption-track.tsx`,
  `src/helpers/caption-layout.ts` y `src/helpers/caption-layout.spec.ts`, y salieron del barrel.
  Es la primera vez que el barrel **pierde** exportaciones (`CaptionTrack`, `CaptionTrackProps`,
  `captionLayout`); no quedan consumidores en el repo. También se saldó la deuda de
  `caption-safe-zone.spec.ts`, que verificaba contención con `captionLayout`.
- `Root.tsx` registra una tercera `Composition` (`CaptionPresetGallery`, 4320x1920) para inspección
  visual de los cuatro presets en `remotion studio`. Sigue sin exportarse desde el barrel.
- Suite: 22 archivos / 244 tests, cobertura 96.77 % stmts / 93.16 % branches / 98.07 % funcs.
  Sube en ambos ejes contra el cierre de `cycle-01` (96.2 % / 92.38 %) y cumple el piso de RNF-2
  (>= 90 % stmts / >= 85 % ramas). El umbral de `vite.config.ts` sigue en 80 %.

## Estructura

- Helpers nuevos (puros, sin React): `helpers/caption-animation.ts`
  (`captionClipAnimation` + `captionBlockStyle`; `CaptionAnimation` es una unión discriminada por
  `mode: 'pop' | 'rise' | 'fade'`), `helpers/caption-active-word.ts` (`activeWordIndex`,
  `captionWordRenders`) y `helpers/caption-clip-plan.ts` (`captionClipPlan`, `captionBoxStyle`).
- `CaptionPreset` gana el campo obligatorio `animation: CaptionAnimation` — todo preset nuevo debe
  declararlo.
- **Precedencia de caja (invariante a no romper):** `captionClipPlan` usa `boxSource` con default
  `'preset'`. `buildTimeline` de `timeline-core` SIEMPRE rellena `CaptionClip.box`, así que un
  default `'clip'` dejaría muerto todo el trabajo de safe zones / anchor / `boxHeightRatio` de
  cycle-01 sin que ningún test unitario lo note. `caption-clip-plan.spec.ts` fija las dos ramas
  contra una `Timeline` real construida con `buildExampleTimeline`.
- **Un solo `transform` por elemento:** la jerarquía es `Sequence > div de caja
  (captionBoxStyle: posición y fontSize, sin `transform`) > div de bloque (captionBlockStyle:
  `opacity` + `transform`) > span por palabra`. Agregar un `transform` al div de caja pisaría la
  animación.
- Componentes nuevos: `components/kinetic-captions.tsx` (en el barrel) y
  `components/caption-preset-gallery.tsx` (fuera del barrel, solo para studio).
- Convención de tipos: los props de un componente que se registra como `<Composition>` van como
  `type`, no `interface` — una `interface` no satisface `Record<string, unknown>` por no tener
  índice de firma implícito. Aplica a `TimelineCompositionProps` y `CaptionPresetGalleryProps`.
- `src/Root.spec.tsx` (nuevo): verifica el registro de composiciones inspeccionando el árbol de
  elementos, sin montar Remotion. Los `.tsx` de `src/components` y `src/Root.tsx` quedan fuera de
  `coverage.include` (solo `src/helpers` y `src/transitions`), pero sí los cubren `nx lint` y
  `nx build`.

## Dependencias

- Sin dependencias nuevas. `spring` e `interpolate` salen de `remotion`, que ya estaba.

## Qué sigue

- **Defecto latente en el target `smoke`, NO introducido por este ciclo:** `nx run
  composition-remotion:smoke` falla con `Cannot find module '../../libs/timeline-core/src'`. El
  target corre `node -r @swc-node/register ./src/smoke.ts` sin `tsconfig-paths`, y `@swc-node/register`
  resuelve el alias `@video-maker/timeline-core` sin el `/index.ts` que declara `tsconfig.base.json`.
  Viene de `spec-001 cycle-03`, donde el CA se cerró como "procedimiento documentado, nunca
  ejecutado". Hay que resolverlo por FIX GATE a nivel repo (toca `project.json` o `tsconfig.base.json`).
  Mientras tanto la verificación visual se hace con `nx run composition-remotion:studio`.
- La lib queda libre para `spec-004` (mezcla de audio) y `spec-006` (web studio). Ningún pendiente
  propio de captions.
