# Architect — Cycle 3: Motion Mode (auto-storyboard)

> **Input:** functional.md · **Generado por:** sdd-architect (actor único)

## 0. Resumen

```
brief.json ─parseMotionBrief─▶ MotionBrief ─┐
brand.json ─parseBrandManifest─▶ BrandManifest ─┴▶ buildAutoStoryboardRequest ─▶ {systemPrompt, userPrompt, jsonSchema}
                                                         │
                                ask(request) (Claude CLI / OpenRouter) ─▶ json
                                                         │
                     enforceBrief ▶ parseMotionStoryboard ▶ checkStoryboardAgainstBrief ─(falla)─▶ 1 reparación
                                                         │
                                                  MotionStoryboard ─▶ composeStoryboard (cycle-02)
```

## 1. Contrato MotionBrief (v1) — `libs/motion-graphics/src/auto/motion-brief.ts`

```ts
{
  version: 1,
  brand: string,                       // id de assets/brands/<marca>
  title?: string,
  format: '16:9' | '9:16',             // default '16:9'
  beatSync: boolean,                   // default true
  music: 'auto' | string | null,       // 'auto' = la IA elige; string = id del tema; null = sin música
  goal?: string,                       // qué tiene que lograr el video
  audience?: string,
  script: string,                      // guion en texto plano
  images: Array<{ file: string; caption: string }>   // file relativo al brief, 0–12
}
```

## 2. Pedido a la IA — `src/auto/build-auto-storyboard-request.ts`

- `systemPrompt`: rol, reglas duras (no HTML, voz en el idioma del guion con el nombre hablado de la marca,
  números de la voz en palabras, 6–12 escenas, `hook` al inicio y `cta` al final, `brand-reveal` con
  `anchor: "drop"` cuando el tema tiene drop, cues = palabras de la voz, sólo imágenes del brief o de la marca),
  y una guía por tipo de escena generada desde `SCENE_GUIDE` (para qué sirve cada una).
- `userPrompt`: marca (nombre, nombre hablado, tagline, equipos, imágenes `brand:`, temas con mood/BPM),
  brief (objetivo, público, formato) y el guion; imágenes como `images/<archivo>` + descripción.
- `jsonSchema`: `motionStoryboardJsonSchema()` (cycle-02).

## 3. Verificación — `src/auto/check-storyboard-against-brief.ts`

`enforceBrief(raw, brief)` pisa `version`, `brand`, `format`, `beatSync`, `title` (si lo trae el brief) y
`music` (salvo `auto`). `checkStoryboardAgainstBrief(sb, brief, brand)` devuelve `StoryboardIssue[]`
(`{path, message}`): imagen fuera de `images/<file>` del brief o de `brand.images`, equipo fuera de
`brand.devices`, cue que no es prefijo (sin tildes ni mayúsculas) de una palabra de la voz de su escena,
tema fuera de `brand.music`.

## 4. Orquestación — `src/auto/generate-motion-storyboard.ts`

`generateMotionStoryboard(ask, brief, brand)` con `ask: (req) => Promise<{json, usage}>` (estructuralmente
compatible con `AiAgentPort` de render-api, sin depender de la app). Primer intento → si hay errores
(zod o verificación) → segundo pedido con la lista de errores y la respuesta anterior → si falla,
`MotionStudioError('STORYBOARD_INVALID')` con los errores. Devuelve `{storyboard, usage, repaired}`.

## 5. Tool — `tools/motion-studio`

- `MotionDependencies.askAgent(request)`: adaptador Claude CLI (`--print --system-prompt --output-format json
  --json-schema --tools "" --model`) con `CLAUDE_CLI_PATH` (default `claude`) y `MOTION_STUDIO_MODEL`
  (default `sonnet`), lee `structured_output` y `usage`.
- `auto <brief.json> <proyecto>`: lee el brief y la marca, genera, escribe `storyboard.json` en el proyecto,
  copia las imágenes y compone como `storyboard`.

## 6. Errores

Códigos nuevos de `MotionStudioError`: `BRIEF_INVALID`, `AI_FAILED`.
