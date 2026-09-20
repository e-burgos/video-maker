# timeline-core

Lib de dominio TypeScript pura: fuente de verdad de los contratos de datos del motor de video
(`Timeline`, `EditDecisionList`, `Transcription`, `MediaAsset`, `AudioMixPlan`, `OutputFormat`) y
de los cálculos de edición que los producen y validan. Sin I/O, sin React, sin dependencia de
ninguna otra lib del repo.

Se importa por source vía el alias `@video-maker/timeline-core`.

## API pública

Todo lo exportado vive en `src/index.ts`. Resumen por área (firmas completas en `architect.md` §4):

| Área | Exports principales |
| --- | --- |
| Unidades y formato | `msToFrames`, `framesToMs`, `defaultFormat`, `safeZoneFor` |
| Silencios y poda | `detectSilencesFromWords`, `mergeSilences`, `pruneSilences`, `remapMsAfterCuts` |
| Punch-ins | `planPunchIns` |
| Captions | `groupWordsForCaptions`, `pickEmphasisIndex` |
| Ducking | `planDucking`, `DEFAULT_MUSIC_MIX`, `DEFAULT_AUDIO_MIX_PLAN` |
| Timeline | `buildTimeline`, `TimelineBuildError`, `validateTimeline`, `timelineWarnings` |
| Bumpers de logo | `LogoBumperSchema`, `TimelineBumpersSchema`, `timelineTotalFrames`, `introBumperFrames`, `outroBumperFrames`, `logoBumperFrames` |
| Transcripción | `normalizeTranscriptionWords` |
| Schemas Zod | `OutputFormatSchema`, `MediaAssetSchema`, `TranscriptionSchema`, `EditDecisionListSchema` (+ decisiones), `AudioMixPlanSchema`, `TimelineSchema` y los tipos inferidos homónimos |
| JSON Schema | `buildJsonSchemaBundle`, `timelineToJsonSchema`, `serializeJsonSchemaFile` |

Los tests nunca importan desde este barrel: cada uno prueba su módulo por ruta relativa. El único
test que consume `src/index.ts` es `schemas.spec.ts`, y solo para afirmar que la superficie
pública no cambió sin querer.

## Comandos

```bash
pnpm nx lint timeline-core
pnpm nx test timeline-core
pnpm nx build timeline-core     # tsc -p tsconfig.lib.json — typecheck + .d.ts, sin bundler
pnpm nx run timeline-core:schemas
```

## JSON Schema commiteados

`schemas/*.schema.json` (`output-format`, `media-asset`, `transcription`, `edit-decision-list`,
`audio-mix-plan`, `timeline`) son **generados, no editables a mano**. Salen de los contratos Zod
vía `z.toJSONSchema()` (Zod 4) y se commitean junto al código que los produce.

Para regenerarlos tras cambiar un schema:

```bash
pnpm nx run timeline-core:schemas
git diff libs/timeline-core/schemas   # revisar el delta antes de commitear
```

El generador (`tools/generate-schemas.ts`) corre con `node -r @swc-node/register` — el registro
ESM (`--import @swc-node/register/esm-register`) trata los `.ts` del repo como CommonJS al no
declarar `"type": "module"`, lo que rompe la resolución de imports sin extensión; el registro
CJS clásico no tiene ese problema.

**El generador manda sobre la serialización** (`oneOf` vs `anyOf`, orden de claves, `$defs`
inline vs referenciado): la spec es normativa sobre qué campos/enums/constraints existen, no sobre
cómo Zod los serializa. Un bump de Zod que cambie la forma del JSON Schema hace fallar el test
anti-drift (`src/schemas/schemas.spec.ts`) — es la señal para revisar el nuevo output y
recommitearlo, no un bug.

`$id` es siempre `https://video-maker.local/schemas/<nombre>.schema.json` y los `$ref` entre
archivos son relativos (`"output-format.schema.json"`). Cuando dos documentos distintos reusan la
misma subestructura Zod (p. ej. `z.json()`), el generador la inlinea como `$defs` local de cada
archivo en vez de crear un `__shared.schema.json` externo: los seis archivos quedan autocontenidos.

## Determinismo (RNF-4/RNF-7)

Nada en esta lib lee `Date`, `process`, `Math.random()` ni hace I/O — el tiempo y el azar (seed de
`mulberry32`) entran siempre por parámetro. `eslint.config.mjs` lo hace cumplir con
`no-restricted-globals`/`no-restricted-properties`/`no-restricted-imports` sobre `src/**/*.ts`
(los `*.spec.ts` quedan exceptuados: el test anti-drift necesita `node:fs` para leer los
`schemas/*.schema.json` commiteados).

## Notas de comportamiento (no son bugs)

- `detectSilencesFromWords` no reporta silencio inicial ni final (antes de la primera palabra o
  después de la última): solo mira huecos *entre* palabras. Ese material lo aporta
  `silencedetect` de FFmpeg en `libs/media-local` (cycle-02).
- `buildTimeline` posiciona los overlays (punch-in, B-roll, captions, ducking) relativo al `keep`
  que los contiene, no reutilizando `remapMsAfterCuts` — ese remapeo no descuenta los frames que
  consumen las transiciones. `remapMsAfterCuts` sigue siendo API pública para otros consumidores.

## Bumpers de logo (FIX-e-burgos-001-003)

`timeline.bumpers` es opcional y declara la placa de marca con la que el video abre (`intro`) y
cierra (`outro`): `enabled`, `durationMs` (500–6000, default 2000), `backgroundColor` (hex
`#rrggbb`, default `#ffffff`), `animation` (`fade` | `zoom` | `slide-up`, default `zoom`) y
`logoWidthRatio` (default 0.4). El logo que dibuja es el de `timeline.logo`; sin logo la placa es
sólo el fondo de color y `timelineWarnings` devuelve `BUMPER_WITHOUT_LOGO` — **warning, no error**:
`validateTimeline` no lo reporta y no bloquea ni el guardado ni el render.

**`durationFrames` sigue siendo el contenido.** La duración total del video la da
`timelineTotalFrames(timeline)` (= intro + contenido + outro), y es la que usan el render, el
`<Player>` de la web y el reporte de la API.
