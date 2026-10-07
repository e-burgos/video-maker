# Architect — Cycle 2: Motion Mode (scene-catalog)

> **Input:** functional.md · **Generado por:** sdd-architect (actor único)

## 0. Resumen

```
storyboard.json ──parseMotionStoryboard──▶ MotionStoryboard
        │                                        │
        └──── composeStoryboard(sb, brand) ──────┴─▶ index.html.tpl (escenas con data-anim) + script.json (MotionScript)
                                                       │
                     voice ▶ plan ▶ compose ▶ render  (sin cambios, ahora en libs/motion-graphics)
```

## 1. libs/motion-graphics

- Tags `scope:engine`, `type:util`; depende solo de `zod` (raíz). Alias `@video-maker/motion-graphics` en
  `tsconfig.base.json` y en el `vite.config.ts` de cada consumidor (lección del proyecto: tres resolvedores).
- `src/beats`, `src/timeline`, `src/voice`, `src/template`, `src/script`: movidos tal cual desde la tool.
- `src/storyboard/motion-storyboard.schema.ts`: `MotionStoryboardSchema` + `motionStoryboardJsonSchema()`.
- `src/scenes/<kind>.ts`: `render<Kind>(scene, ctx) → string` (markup); un `SCENE_RENDERERS` exhaustivo por kind.
- `src/brand/brand-manifest.ts`: `BrandManifestSchema` (name, tagline, logo, isotipo, devices{id: image, screen polygon?}, music[]{file, credit, bpm}, url).
- `src/compose/compose-storyboard.ts`: arma el documento completo (head, HUD, escenas, pistas) como plantilla con
  los mismos placeholders `{{start:id}}`… y el `MotionScript` con `vo`, `minBars`, `anchor`.
- `assets/runtime/` (kit.js, scenes.css, gsap.min.js, sfx/) y `assets/brands/displayads/` (brand.json, fuentes,
  logos, imágenes, música), servidos al proyecto por `init`.

## 2. Contrato MotionStoryboard (v1)

```ts
{ version: 1, title: string, brand: string, format: '16:9' | '9:16',
  music: { track: string } | null, beatSync: boolean, voice?: { id: string, lengthScale: number },
  scenes: Array<{ id: kebab, kind: SceneKind, chapter?: string, vo: string, minBars?: number,
                  anchor?: 'drop' | number, props: <por kind> }> }
```

16 kinds: `hook`, `problem`, `brand-reveal`, `feature`, `remote-update`, `schedule`, `dashboard`, `ai-generate`,
`context`, `suggestion`, `product`, `gallery`, `step`, `connections`, `do-dont`, `cta`. Cada `props` es un objeto
estricto; los textos que la voz nombra pueden llevar `cue` (prefijo de una palabra de `vo`). Imágenes: rutas
relativas al proyecto (`images/...`) o `brand:<asset>`.

`anchor: 'drop'` = el compás fuerte detectado (primer salto de energía de la grilla): en este ciclo se mapea a
un segundo fijo del tema por `music[].drop` del manifiesto; con `beatSync: false` se ignora.

## 3. Animación declarativa (runtime `kit.js`)

Cada elemento animable lleva `data-anim` (`rise|left|right|pop|fade|blur|wipe|draw|strike|type|count|tap|press|swap|glow`)
y opcionalmente `data-cue` (palabra), `data-at` (s desde el inicio de la escena) o `data-beat` (n-ésimo golpe).
Sin ninguno, entra por orden con medio golpe de separación. Todo cambio de estado es una capa con fundido
(`swap`), nunca un `tl.call`. La salida de cada escena es automática (`leave`).

## 4. Errores

`MotionStudioError` gana `STORYBOARD_INVALID` (camino del campo) y `ASSET_MISSING` (imagen o recurso de marca).
