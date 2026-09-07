# SPEC-e-burgos-001: Core Composition & Media Pipeline Engine

> spec-id: spec-e-burgos-001-core-composition-media-pipeline
> slug: core-composition-media-pipeline
> módulo: core-composition-media-pipeline
> estado: activo
> fecha: 2026-09-07
> Estado: **draft** — el sdd-orchestrator la pasa a `in-progress` al abrir `cycle-01`.

## Resumen Ejecutivo

Se construye el **motor base** del producto declarado en `sdd/global.json`: un núcleo en TypeScript
que representa un video social como datos (una `Timeline` y una lista de decisiones de edición,
`EditDecisionList`), calcula sobre esos datos todo lo que hoy hace a mano un editor (cortar
silencios, alternar punch-ins, agrupar palabras para subtítulos, automatizar el ducking de la música)
y lo materializa con herramientas **100% locales**: FFmpeg para sondear/normalizar/mezclar,
Whisper local para transcribir palabra por palabra y Remotion para componer y renderizar.

El motor es **declarativo y determinista**: la misma `Timeline` produce siempre el mismo video, y
los cálculos de edición se validan con Vitest sin renderizar un solo frame. Se entrega como tres
libs Nx nuevas (`libs/timeline-core`, `libs/media-local`, `libs/composition-remotion`) que las specs
posteriores (montaje automático, captions cinéticos, mezcla de audio, servicio de render y web studio)
consumen sin reimplementar nada.

## Contexto de Negocio

Los creadores que publican Reels, TikToks y videos de YouTube repiten en cada pieza el mismo trabajo
mecánico: importar el metraje, cortar muletillas y silencios, superponer B-roll cuando hablan de
algo concreto, subtitular palabra por palabra, mantener el ritmo con punch-ins y balancear voz
contra música. Las herramientas que automatizan eso son SaaS pagos por minuto de video y suben el
material a la nube.

Este motor apunta a cuatro tipos de contenido que comparten ese flujo:

| Caso de uso                          | Rasgo distintivo que el motor debe soportar                              |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Demos de software / productos digitales | Grabaciones de pantalla, zoom a zonas de UI, B-roll contextual         |
| Hardware + software                  | Metraje del dispositivo en operación intercalado con la pantalla         |
| Recetas / cocina                     | Cortes por acción, tomas cenitales, ritmo variable                       |
| Educativos y promociones             | Jump cuts con punch-in digital, retención alta, subtítulos de impacto    |

**Usuarios:** el propio dev/creador que opera el sistema en su máquina. **Impacto esperado:** pasar
de horas de edición manual a minutos de revisión sobre un borrador generado, sin costo por minuto ni
salida del material del equipo local.

## Evidencia y decisiones

> No existe todavía `harness.idea.md` en este repo; la evidencia es el brief de misión del dev
> recibido en la sesión de arranque (2026-09-07). Cuando se registre la idea con `harness idea`,
> reemplazar estas viñetas por citas a ese archivo.

- Evidencia: brief del dev → formatos objetivo 9:16 (Reels/TikTok) y 16:9 (YouTube) (2026-09-07).
- Evidencia: brief del dev → material de entrada real: clips de cámara/pantalla, fotos de apoyo,
  locución grabada y música de fondo (2026-09-07).
- Decisión: **sin APIs externas pagas**; todo el procesamiento corre local con FFmpeg, Whisper
  local (whisper.cpp / Faster-Whisper) y Remotion (2026-09-07).
- Decisión: motor **declarativo en TypeScript** — la edición es un documento de datos, no código
  imperativo por video (2026-09-07).
- Decisión: parámetros de edición fijados por el dev como defaults: silencios `> 0.5 s`, locución a
  `-14 LUFS`, música duckeada a `-24 dB`, punch-in `110%–115%`, captions de 1–3 palabras con resaltado
  de impacto y safe zones de Instagram/TikTok (2026-09-07).
- Decisión (arquitecto, 2026-09-07): los cálculos de timeline se prueban con Vitest **sin render**;
  el render real se verifica con un script manual de smoke, fuera de CI.
- Evidencia: hardware del dev → MacBook Pro M2, 16 GB de RAM unificada (2026-09-07).
- Decisión del dev (2026-09-07): whisper.cpp como motor de transcripción por defecto, compilado con
  Metal; modelo recomendado `ggml-large-v3-turbo-q5_0` (~550 MB, entra holgado en 16 GB), fallback
  `ggml-small`. Faster-Whisper queda solo como formato de entrada JSON.
- Decisión del dev (2026-09-07): el `-24 dB` de la música es ganancia relativa bajo la voz, con base
  `-12 dB` cuando no hay locución (confirma el default del `AudioMixPlan`).
- Decisión del dev (2026-09-07): el producto es de uso personal → licencia gratuita de Remotion.

## Alcance

**Dentro de esta spec:**

1. Contratos de datos versionados (`Timeline`, `MediaAsset`, `Transcription`, `EditDecisionList`,
   `AudioMixPlan`, `CaptionGroup`) como schemas Zod con JSON Schema generado y commiteado.
2. Cálculos puros de edición: poda de silencios, plan de punch-ins, agrupado de palabras para
   captions, automatización de ducking, safe zones por formato, construcción y validación de la
   `Timeline` a partir de una `EditDecisionList`.
3. Wrappers tipados y testeables de FFmpeg/ffprobe (probe, `silencedetect`, `loudnorm`, extracción de
   audio) y parsers de la salida JSON de whisper.cpp y Faster-Whisper hacia `Transcription`.
4. Composición Remotion base que renderiza una `Timeline`: pistas de video/imagen/audio,
   `TransitionSeries` con `springTiming`, transiciones `fade`, `slide` y `whip-pan`, y un punto de
   entrada Node para render headless.

**Fuera de esta spec (specs posteriores, ya registradas en `sdd/specs/index.json`):**

- Matching semántico de B-roll por conceptos de la locución, presets por caso de uso y CLI de
  pipeline completo → `spec-e-burgos-002-auto-montage-pipeline`.
- Componente de kinetic typography con estilos, fuentes y resaltado visual → `spec-e-burgos-003-kinetic-captions`
  (esta spec entrega el **agrupado** de palabras, no el componente visual).
- Mezcla final multi-pista y mastering con filtergraphs FFmpeg → `spec-e-burgos-004-audio-mix-mastering`
  (esta spec entrega el **plan** de ducking y la normalización de un archivo de voz).
- Cola de renders, almacenamiento en MinIO y API local → `spec-e-burgos-005-render-service`.
- UI de previsualización y gestión de assets en `apps/web` → `spec-e-burgos-006-web-studio`.

## Arquitectura

### Libs Nx nuevas

| Lib                         | Package                            | Tipo Nx                | Entorno        | Responsabilidad                                                                 |
| --------------------------- | ---------------------------------- | ---------------------- | -------------- | ------------------------------------------------------------------------------- |
| `libs/timeline-core`        | `@video-maker/timeline-core`       | `@nx/js:lib` (vitest)  | isomórfico     | Contratos Zod/JSON Schema + cálculos puros de edición. **Cero I/O, cero React.** |
| `libs/media-local`          | `@video-maker/media-local`         | `@nx/js:lib` (vitest)  | Node ≥ 22      | Wrappers de binarios locales (ffmpeg, ffprobe, whisper-cli) y parsers de su salida. |
| `libs/composition-remotion` | `@video-maker/composition-remotion` | `@nx/react:lib` (vitest) | React 19 + Node | Componentes Remotion que renderizan una `Timeline` y entrada de render headless. |

Grafo de dependencias permitido (Nx `@nx/enforce-module-boundaries` con tags):

```
timeline-core        tags: scope:engine, type:domain      → no depende de ninguna lib del repo
media-local          tags: scope:engine, type:util        → timeline-core
composition-remotion tags: scope:engine, type:ui          → timeline-core
apps/web, apps/render-api, libs/auto-montage (specs futuras) → cualquiera de las tres
```

> `harness add` no tiene subcomando `lib` (solo `app | skill | service | spec`). Las tres libs se
> crean en `cycle-01`/`cycle-02`/`cycle-03` con la skill **`scaffold-nx`** (generadores oficiales de
> Nx), respetando las invariantes de `init-nx-workspace`: viven en `libs/`, alias en
> `tsconfig.base.json` → `paths` siguiendo la convención ya usada por `shared-utils`, y contexto
> SDD en `sdd/context/libs/[nombre]/` creado por el orquestador en el primer ciclo que las toque.

### Principios del motor

1. **Unidades explícitas.** El dominio de medios habla en milisegundos (`Ms`, entero, lo que devuelve
   ffprobe/Whisper); la `Timeline` habla en frames (`Frame`, entero, lo nativo de Remotion). La única
   conversión es `msToFrames(ms, fps, rounding)` y está testeada en los bordes.
2. **Determinismo.** Ninguna función de `timeline-core` lee reloj, entorno ni aleatoriedad; si un
   cálculo necesita variación (alternancia de punch-ins) recibe un `seed` explícito.
3. **Contrato conservador.** Toda entrada externa (JSON de ffprobe, Whisper, timelines guardadas) pasa
   por `safeParse` de Zod y se rechaza con error tipado; nunca se completa con valores inventados.
4. **Sin binarios en CI.** `media-local` recibe un `CommandRunner` inyectable; los tests usan fixtures
   grabadas de la salida real de ffprobe/ffmpeg/whisper. Los binarios solo se exigen en el smoke manual.
5. **Render como función.** `composition-remotion` no tiene estado propio: `Timeline` entra, frames
   salen. Los helpers que mapean `Timeline` → props de `Sequence`/`TransitionSeries` son puros y se
   testean sin montar Remotion.

## Contratos de datos

Fuente de verdad: schemas Zod en `libs/timeline-core/src/schemas/`. De cada uno se genera JSON Schema
(draft 2020-12, `z.toJSONSchema()` de Zod 4) a `libs/timeline-core/schemas/*.schema.json` y un test
falla si el archivo commiteado difiere del generado (anti-drift). Los JSON Schema abajo son el contrato
que el implementador debe reproducir; los campos opcionales se marcan con `?` en la prosa.

### Tipos base

| Tipo            | Definición                                                          |
| --------------- | ------------------------------------------------------------------- |
| `Ms`            | entero ≥ 0, milisegundos sobre el medio fuente                      |
| `Frame`         | entero ≥ 0, posición/duración en la timeline a `format.fps`         |
| `Db`            | número, ganancia relativa en dB (negativo = atenúa)                 |
| `Lufs`          | número ≤ 0, loudness integrado EBU R128                             |
| `Scale`         | número en `[1.0, 2.0]`; punch-in válido de producto: `[1.10, 1.15]` |
| `AssetId`, `ClipId`, `DecisionId` | string no vacío, único dentro de su documento         |

### `OutputFormat`

```json
{
  "$id": "https://video-maker.local/schemas/output-format.schema.json",
  "type": "object",
  "required": ["preset", "width", "height", "fps"],
  "additionalProperties": false,
  "properties": {
    "preset": { "enum": ["reels-9x16", "tiktok-9x16", "shorts-9x16", "youtube-16x9"] },
    "width": { "type": "integer", "minimum": 240 },
    "height": { "type": "integer", "minimum": 240 },
    "fps": { "enum": [24, 25, 30, 50, 60] }
  }
}
```

Defaults por preset: `*-9x16` → 1080×1920 @ 30 fps; `youtube-16x9` → 1920×1080 @ 30 fps.

### `MediaAsset` (salida de `probeMedia`)

```json
{
  "$id": "https://video-maker.local/schemas/media-asset.schema.json",
  "type": "object",
  "required": ["id", "kind", "path", "durationMs", "probedAt"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "minLength": 1 },
    "kind": { "enum": ["video", "image", "audio"] },
    "path": { "type": "string", "minLength": 1 },
    "durationMs": { "type": "integer", "minimum": 0 },
    "fps": { "type": "number", "exclusiveMinimum": 0 },
    "width": { "type": "integer", "minimum": 1 },
    "height": { "type": "integer", "minimum": 1 },
    "rotation": { "enum": [0, 90, 180, 270] },
    "hasAudio": { "type": "boolean" },
    "audio": {
      "type": "object",
      "required": ["sampleRate", "channels"],
      "properties": {
        "sampleRate": { "type": "integer" },
        "channels": { "type": "integer", "minimum": 1 },
        "codec": { "type": "string" },
        "integratedLufs": { "type": "number" }
      }
    },
    "videoCodec": { "type": "string" },
    "probedAt": { "type": "string", "format": "date-time" }
  }
}
```

Reglas: `image` tiene `durationMs = 0` y sin `fps`; `video` exige `fps`, `width`, `height`, `hasAudio`.

### `Transcription` (salida de los parsers Whisper)

```json
{
  "$id": "https://video-maker.local/schemas/transcription.schema.json",
  "type": "object",
  "required": ["assetId", "engine", "language", "words", "segments"],
  "additionalProperties": false,
  "properties": {
    "assetId": { "type": "string" },
    "engine": { "enum": ["whisper.cpp", "faster-whisper"] },
    "model": { "type": "string" },
    "language": { "type": "string", "pattern": "^[a-z]{2}(-[A-Z]{2})?$" },
    "words": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["text", "startMs", "endMs"],
        "additionalProperties": false,
        "properties": {
          "text": { "type": "string", "minLength": 1 },
          "startMs": { "type": "integer", "minimum": 0 },
          "endMs": { "type": "integer", "minimum": 0 },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    },
    "segments": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["startMs", "endMs", "text", "wordRange"],
        "properties": {
          "startMs": { "type": "integer" },
          "endMs": { "type": "integer" },
          "text": { "type": "string" },
          "wordRange": { "type": "array", "items": { "type": "integer" }, "minItems": 2, "maxItems": 2 }
        }
      }
    }
  }
}
```

Invariantes validadas por Zod `superRefine`: `words` ordenadas por `startMs`, `endMs ≥ startMs`,
sin solapamiento entre palabras consecutivas (se normaliza recortando al `startMs` de la siguiente).

### `EditDecisionList` (EDL) — decisiones de edición sobre un asset A-roll

```json
{
  "$id": "https://video-maker.local/schemas/edit-decision-list.schema.json",
  "type": "object",
  "required": ["schemaVersion", "sourceAssetId", "format", "decisions", "generatedBy"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": 1 },
    "sourceAssetId": { "type": "string" },
    "format": { "$ref": "output-format.schema.json" },
    "generatedBy": {
      "type": "object",
      "required": ["tool", "params"],
      "properties": { "tool": { "type": "string" }, "params": { "type": "object" } }
    },
    "decisions": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object", "required": ["id", "type", "startMs", "endMs"],
            "properties": { "id": {"type":"string"}, "type": { "const": "keep" },
              "startMs": {"type":"integer"}, "endMs": {"type":"integer"} }
          },
          {
            "type": "object", "required": ["id", "type", "startMs", "endMs", "reason"],
            "properties": { "id": {"type":"string"}, "type": { "const": "cut" },
              "startMs": {"type":"integer"}, "endMs": {"type":"integer"},
              "reason": { "enum": ["silence", "manual", "filler-word"] } }
          },
          {
            "type": "object", "required": ["id", "type", "startMs", "endMs", "scale"],
            "properties": { "id": {"type":"string"}, "type": { "const": "punch-in" },
              "startMs": {"type":"integer"}, "endMs": {"type":"integer"},
              "scale": { "type": "number", "minimum": 1.0, "maximum": 2.0 },
              "anchor": { "enum": ["center", "top", "face-hint"] } }
          },
          {
            "type": "object", "required": ["id", "type", "startMs", "endMs", "assetId", "fit"],
            "properties": { "id": {"type":"string"}, "type": { "const": "broll-overlay" },
              "startMs": {"type":"integer"}, "endMs": {"type":"integer"},
              "assetId": {"type":"string"}, "fit": { "enum": ["cover", "contain", "pip"] },
              "keepVoice": { "type": "boolean", "default": true } }
          },
          {
            "type": "object", "required": ["id", "type", "atMs", "kind", "durationMs"],
            "properties": { "id": {"type":"string"}, "type": { "const": "transition" },
              "atMs": {"type":"integer"}, "durationMs": {"type":"integer","minimum":1},
              "kind": { "enum": ["fade", "slide", "whip-pan", "light-leak"] },
              "direction": { "enum": ["from-left", "from-right", "from-top", "from-bottom"] },
              "timing": { "enum": ["spring", "linear"] } }
          },
          {
            "type": "object", "required": ["id", "type", "startMs", "endMs", "words"],
            "properties": { "id": {"type":"string"}, "type": { "const": "caption-group" },
              "startMs": {"type":"integer"}, "endMs": {"type":"integer"},
              "words": { "type": "array", "minItems": 1, "maxItems": 3,
                "items": { "type": "object", "required": ["text","startMs","endMs"],
                  "properties": { "text": {"type":"string"}, "startMs": {"type":"integer"}, "endMs": {"type":"integer"} } } },
              "emphasisIndex": { "type": "integer", "minimum": 0, "maximum": 2 } }
          },
          {
            "type": "object", "required": ["id", "type", "startMs", "endMs", "gainDb"],
            "properties": { "id": {"type":"string"}, "type": { "const": "duck" },
              "startMs": {"type":"integer"}, "endMs": {"type":"integer"},
              "gainDb": { "type": "number", "maximum": 0 } }
          }
        ]
      }
    }
  }
}
```

Invariantes: `keep` y `cut` particionan `[0, durationMs]` del asset fuente sin huecos ni
solapamientos; `punch-in`, `broll-overlay`, `caption-group` y `duck` solo pueden caer dentro de rangos
`keep`; toda `transition.atMs` coincide con el borde entre dos `keep` consecutivos.

### `AudioMixPlan`

```json
{
  "$id": "https://video-maker.local/schemas/audio-mix-plan.schema.json",
  "type": "object",
  "required": ["voice", "music", "automation"],
  "additionalProperties": false,
  "properties": {
    "voice": {
      "type": "object", "required": ["integratedLufs", "truePeakDbtp", "loudnessRange"],
      "properties": {
        "integratedLufs": { "type": "number", "default": -14 },
        "truePeakDbtp": { "type": "number", "default": -1 },
        "loudnessRange": { "type": "number", "default": 11 }
      }
    },
    "music": {
      "type": "object", "required": ["baseGainDb", "duckedGainDb", "attackMs", "releaseMs", "holdMs"],
      "properties": {
        "baseGainDb": { "type": "number", "default": -12 },
        "duckedGainDb": { "type": "number", "default": -24 },
        "attackMs": { "type": "integer", "default": 150 },
        "releaseMs": { "type": "integer", "default": 400 },
        "holdMs": { "type": "integer", "default": 250 }
      }
    },
    "automation": {
      "type": "array",
      "items": {
        "type": "object", "required": ["frame", "gainDb"],
        "properties": { "frame": { "type": "integer", "minimum": 0 }, "gainDb": { "type": "number" } }
      }
    }
  }
}
```

### `Timeline` — documento final que consume Remotion

```json
{
  "$id": "https://video-maker.local/schemas/timeline.schema.json",
  "type": "object",
  "required": ["schemaVersion", "id", "format", "durationFrames", "assets", "tracks", "audioMix"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": { "const": 1 },
    "id": { "type": "string" },
    "format": { "$ref": "output-format.schema.json" },
    "durationFrames": { "type": "integer", "minimum": 1 },
    "assets": { "type": "array", "items": { "$ref": "media-asset.schema.json" } },
    "tracks": {
      "type": "object",
      "required": ["aroll", "broll", "voice", "music", "captions"],
      "properties": {
        "aroll":    { "type": "array", "items": { "$ref": "#/$defs/videoClip" } },
        "broll":    { "type": "array", "items": { "$ref": "#/$defs/videoClip" } },
        "voice":    { "type": "array", "items": { "$ref": "#/$defs/audioClip" } },
        "music":    { "type": "array", "items": { "$ref": "#/$defs/audioClip" } },
        "captions": { "type": "array", "items": { "$ref": "#/$defs/captionClip" } }
      }
    },
    "transitions": { "type": "array", "items": { "$ref": "#/$defs/transition" } },
    "audioMix": { "$ref": "audio-mix-plan.schema.json" },
    "safeZone": { "$ref": "#/$defs/safeZone" }
  },
  "$defs": {
    "videoClip": {
      "type": "object",
      "required": ["id", "assetId", "from", "durationFrames", "trimStartMs", "transform"],
      "properties": {
        "id": { "type": "string" }, "assetId": { "type": "string" },
        "from": { "type": "integer", "minimum": 0 },
        "durationFrames": { "type": "integer", "minimum": 1 },
        "trimStartMs": { "type": "integer", "minimum": 0 },
        "fit": { "enum": ["cover", "contain", "pip"] },
        "transform": {
          "type": "object", "required": ["scale", "translateX", "translateY"],
          "properties": { "scale": { "type": "number" }, "translateX": { "type": "number" }, "translateY": { "type": "number" } }
        },
        "muted": { "type": "boolean" }
      }
    },
    "audioClip": {
      "type": "object",
      "required": ["id", "assetId", "from", "durationFrames", "trimStartMs", "gainDb"],
      "properties": {
        "id": { "type": "string" }, "assetId": { "type": "string" },
        "from": { "type": "integer" }, "durationFrames": { "type": "integer", "minimum": 1 },
        "trimStartMs": { "type": "integer" }, "gainDb": { "type": "number" },
        "fadeInFrames": { "type": "integer" }, "fadeOutFrames": { "type": "integer" }
      }
    },
    "captionClip": {
      "type": "object",
      "required": ["id", "from", "durationFrames", "words"],
      "properties": {
        "id": { "type": "string" }, "from": { "type": "integer" }, "durationFrames": { "type": "integer" },
        "words": { "type": "array", "minItems": 1, "maxItems": 3,
          "items": { "type": "object", "required": ["text", "fromFrame", "durationFrames"],
            "properties": { "text": { "type": "string" }, "fromFrame": { "type": "integer" }, "durationFrames": { "type": "integer" } } } },
        "emphasisIndex": { "type": "integer" }
      }
    },
    "transition": {
      "type": "object",
      "required": ["betweenClipIds", "kind", "durationFrames", "timing"],
      "properties": {
        "betweenClipIds": { "type": "array", "items": { "type": "string" }, "minItems": 2, "maxItems": 2 },
        "kind": { "enum": ["fade", "slide", "whip-pan", "light-leak"] },
        "direction": { "enum": ["from-left", "from-right", "from-top", "from-bottom"] },
        "durationFrames": { "type": "integer", "minimum": 1 },
        "timing": {
          "oneOf": [
            { "type": "object", "required": ["type"], "properties": { "type": { "const": "linear" } } },
            { "type": "object", "required": ["type", "damping", "stiffness", "mass"],
              "properties": { "type": { "const": "spring" }, "damping": { "type": "number" }, "stiffness": { "type": "number" }, "mass": { "type": "number" } } }
          ]
        }
      }
    },
    "safeZone": {
      "type": "object",
      "required": ["top", "bottom", "left", "right"],
      "description": "Márgenes en píxeles donde la UI de la red social tapa el video; los captions se ubican dentro.",
      "properties": { "top": { "type": "integer" }, "bottom": { "type": "integer" }, "left": { "type": "integer" }, "right": { "type": "integer" } }
    }
  }
}
```

Invariantes de `validateTimeline`: los clips de `aroll` no se solapan y cubren `[0, durationFrames)`
sin huecos (salvo los frames que consumen las transiciones); todo `assetId` resuelve en `assets`;
ningún clip excede la duración de su asset (`trimStartMs + durationFrames/fps ≤ durationMs`); todo
`captionClip` cae dentro del `safeZone`.

## Cálculos del motor (`libs/timeline-core`) — API pública

Todas son funciones puras, sin I/O, exportadas desde `src/index.ts`:

| Función                                                | Entrada → Salida                                                                                     | Defaults de producto                                              |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `msToFrames(ms, fps, rounding)` / `framesToMs`         | conversión de unidades                                                                               | `rounding: "round"`                                               |
| `defaultFormat(preset)`                                | `OutputFormat` completo por preset                                                                   | 1080×1920@30 / 1920×1080@30                                       |
| `safeZoneFor(format)`                                  | `SafeZone` por preset                                                                                | 9:16 → top 220, bottom 400, left 60, right 140 px; 16:9 → 60 px en todos |
| `detectSilencesFromWords(transcription, opts)`         | huecos entre palabras → `SilenceRange[]`                                                             | `minSilenceMs: 500`                                               |
| `mergeSilences(a, b)`                                  | unión de rangos de dos fuentes (palabras + `silencedetect`)                                          | —                                                                 |
| `pruneSilences(durationMs, silences, opts)`            | → decisiones `keep`/`cut` que particionan el asset                                                   | `paddingMs: 80`, `minKeepMs: 300`                                 |
| `planPunchIns(keeps, opts)`                            | → decisiones `punch-in` alternando cortes                                                             | `scales: [1.10, 1.15]`, `every: 2`, `seed`                        |
| `groupWordsForCaptions(words, opts)`                   | → decisiones `caption-group` de 1–3 palabras con `emphasisIndex`                                      | `maxWords: 3`, `maxDurationMs: 1200`, `minDurationMs: 300`, `emphasisKeywords: []` |
| `planDucking(voiceRanges, plan, fps)`                  | → `automation[]` (keyframes de ganancia) y decisiones `duck`                                          | `-12 dB` base, `-24 dB` duckeado, attack 150 / hold 250 / release 400 ms |
| `remapMsAfterCuts(ms, keeps)`                          | tiempo fuente → tiempo de la timeline resultante (base de todo el mapeo)                              | —                                                                 |
| `buildTimeline(edl, assets, music?)`                   | `EditDecisionList` + assets → `Timeline` completa                                                     | —                                                                 |
| `validateTimeline(timeline)`                           | → `{ ok: true } \| { ok: false, issues: TimelineIssue[] }`                                             | —                                                                 |
| `timelineToJsonSchema()` y `*Schema` (Zod)             | schemas exportados para generar/validar JSON                                                          | —                                                                 |

Regla de `emphasisIndex`: si algún `emphasisKeywords` matchea, esa palabra; si no, la palabra de mayor
duración del grupo (proxy de énfasis fonético); empate → la última.

## Wrappers locales (`libs/media-local`) — API pública

| Función                                             | Comando subyacente                                                             | Notas                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `resolveBinaries(env)`                              | —                                                                              | `FFMPEG_PATH`, `FFPROBE_PATH`, `WHISPER_CPP_PATH`, `WHISPER_MODEL_PATH`; fallback al `PATH` |
| `probeMedia(path, runner)`                          | `ffprobe -v quiet -print_format json -show_format -show_streams`                | → `MediaAsset`; parser puro `parseFfprobeJson`                        |
| `detectSilencesWithFfmpeg(path, opts, runner)`      | `ffmpeg -af silencedetect=noise=-35dB:d=0.5 -f null -`                          | parser puro de stderr `parseSilenceDetect`                            |
| `measureLoudness(path, runner)`                     | `ffmpeg -af loudnorm=print_format=json -f null -`                               | → `{ integratedLufs, truePeakDbtp, loudnessRange }`                   |
| `normalizeVoice(path, out, target, runner)`         | `loudnorm` en dos pasadas (medición → `measured_*`)                             | target por defecto = `AudioMixPlan.voice`                             |
| `extractAudioForTranscription(path, out, runner)`   | `ffmpeg -vn -ac 1 -ar 16000 -c:a pcm_s16le`                                     | formato que whisper.cpp exige                                         |
| `transcribeWithWhisperCpp(wavPath, opts, runner)`   | `whisper-cli -m <model> -f <wav> -oj -ml 1` (una palabra por token)             | → `Transcription` vía `parseWhisperCppJson`                           |
| `parseFasterWhisperJson(json, assetId)`             | —                                                                              | acepta el JSON de `faster-whisper` con `word_timestamps=True`         |

`CommandRunner` es una interfaz `{ run(bin, args, opts): Promise<{ stdout, stderr, exitCode }> }`
con implementación real sobre `execa` y una `FixtureRunner` para tests. Errores tipados:
`BinaryNotFoundError`, `CommandFailedError` (incluye `stderr` truncado), `UnparseableOutputError`.

## Composición (`libs/composition-remotion`) — API pública

- `<TimelineComposition timeline />`: composición raíz; usa `calculateMetadata` para derivar
  `durationInFrames`, `fps`, `width`, `height` del documento.
- `<ArollTrack />`, `<BrollTrack />`, `<AudioTrack />`, `<CaptionTrack />`: renderizan cada pista con
  `<OffthreadVideo>` (render) / `<Video>` (Player), `<Img>`, `<Audio>` y `<Sequence>`. El
  `CaptionTrack` de esta spec es **mínimo** (texto plano dentro del safe zone); el visual cinético llega en 003.
- `<ArollSeries />`: `TransitionSeries` con `springTiming`/`linearTiming` según `transition.timing`;
  presentaciones `fade`, `slide(direction)` de `@remotion/transitions` y `whipPan(direction)` propia
  (desenfoque de movimiento + desplazamiento). `light-leak` se acepta en el contrato y se renderiza
  como `fade` hasta 002.
- Helpers puros testeables: `timelineToSequenceProps(timeline)`, `transitionTiming(transition, fps)`,
  `punchInStyle(transform)`, `captionLayout(safeZone, format)`.
- `renderTimeline(timeline, { outPath, codec: "h264" })` (Node): `bundle()` + `selectComposition()` +
  `renderMedia()` de `@remotion/bundler`/`@remotion/renderer`. Solo se ejecuta en el smoke manual.
- `Root.tsx` registra `TimelineComposition` con `defaultProps` de ejemplo en 9:16 y 16:9 para
  `remotion studio` (uso local del dev, no forma parte de CI).

## Dependencias

**Paquetes npm (versiones vigentes al 2026-09-07; el implementador pinnea el patch al instalar):**

| Paquete                                                   | Versión  | Lib que lo usa                 | Motivo                                              |
| --------------------------------------------------------- | -------- | ------------------------------ | --------------------------------------------------- |
| `zod`                                                     | ^4.5     | timeline-core                  | schemas + `z.toJSONSchema()` nativo                 |
| `remotion`, `@remotion/transitions`                       | 4.0.521  | composition-remotion           | composición, `TransitionSeries`, `springTiming`     |
| `@remotion/bundler`, `@remotion/renderer`                 | 4.0.521  | composition-remotion (Node)    | render headless                                     |
| `@remotion/cli`                                           | 4.0.521  | composition-remotion (dev)     | `remotion studio` local                             |
| `@remotion/player`                                        | 4.0.521  | (peer para 006)                | preview en `apps/web`                               |
| `execa`                                                   | ^10      | media-local                    | `CommandRunner` real con streams y `exitCode`       |
| `@testing-library/react`, `jsdom`                         | actuales | composition-remotion (dev)     | tests de helpers/layout sin render                  |

Todos los paquetes de Remotion deben ir **en la misma versión exacta** (regla de Remotion). Si pnpm
bloquea algún script de instalación de `@remotion/compositor-*`, se agrega a `onlyBuiltDependencies`
en `pnpm-workspace.yaml` explicando el porqué en el commit.

**Binarios locales (solo para uso real y smoke manual, nunca en CI):**

| Binario           | Versión mínima | Cómo se ubica                                   |
| ----------------- | -------------- | ----------------------------------------------- |
| `ffmpeg`/`ffprobe` | 6.0           | `FFMPEG_PATH`/`FFPROBE_PATH` o `PATH`           |
| `whisper-cli` (whisper.cpp) | 1.7   | `WHISPER_CPP_PATH` + modelo `ggml-*` en `WHISPER_MODEL_PATH` (recomendado `large-v3-turbo`, fallback `small`) |
| Faster-Whisper    | opcional       | solo como formato de entrada JSON (no se invoca desde el motor en esta spec) |
| Chrome Headless Shell | lo descarga Remotion | `renderMedia` lo resuelve solo la primera vez           |

**Módulos previos:** ninguno (es la primera spec). `libs/shared-utils` queda disponible pero no es
dependencia obligatoria.

## Requisitos Funcionales (RF)

- RF-1: El sistema representa cualquier video de salida como un documento `Timeline` validable
  contra su JSON Schema, con formato 9:16 o 16:9.
- RF-2: A partir de una `Transcription` palabra por palabra el sistema detecta silencios mayores a
  `minSilenceMs` (default 500 ms) y genera decisiones `cut`/`keep` que particionan el asset fuente.
- RF-3: El sistema puede fusionar silencios detectados por palabras con los detectados por FFmpeg
  `silencedetect` antes de podar.
- RF-4: El sistema planifica punch-ins digitales entre 110% y 115% alternando cortes de manera
  determinista (misma entrada + mismo `seed` → mismas decisiones).
- RF-5: El sistema agrupa las palabras en captions de 1 a 3 palabras, con duración acotada y un
  índice de énfasis, ubicables dentro del safe zone del formato.
- RF-6: El sistema genera la automatización de ducking de la música (ganancia base y duckeada,
  attack/hold/release) a partir de los rangos donde hay voz.
- RF-7: `buildTimeline` convierte una `EditDecisionList` válida y sus assets en una `Timeline`
  completa y `validateTimeline` reporta toda violación de invariantes con ubicación.
- RF-8: `probeMedia` produce un `MediaAsset` correcto para video, imagen y audio a partir de la
  salida JSON de ffprobe, incluyendo rotación de metadatos de celular.
- RF-9: Los parsers de whisper.cpp (`-oj`) y Faster-Whisper producen la misma `Transcription`
  normalizada para el mismo audio de fixture.
- RF-10: `normalizeVoice` genera los argumentos de `loudnorm` en dos pasadas hacia `-14 LUFS` /
  `-1 dBTP` usando los valores medidos en la primera pasada.
- RF-11: `TimelineComposition` renderiza las pistas A-roll, B-roll, voz, música y captions de una
  `Timeline` con transiciones `fade`, `slide` y `whip-pan` con timing `spring` o `linear`.
- RF-12: `renderTimeline` produce un MP4 H.264 con las dimensiones y fps del `format` (verificado en
  smoke manual, documentado en el README de la lib).

## Requisitos No-Funcionales (RNF)

- RNF-1: TypeScript `strict`, cero `any`, cero comentarios narrativos (regla del repo); ESM.
- RNF-2: Cobertura Vitest ≥ 85% líneas en `timeline-core`, ≥ 80% en `media-local` y en los helpers
  puros de `composition-remotion`.
- RNF-3: La suite completa de las tres libs corre en < 20 s sin ffmpeg, whisper ni Chrome instalados.
- RNF-4: Determinismo: ningún test depende de reloj, aleatoriedad sin seed ni orden de ejecución.
- RNF-5: `timeline-core` no importa Node APIs ni React (debe poder cargarse en el browser para 006).
- RNF-6: Cada lib expone su API solo desde `src/index.ts`; `enforce-module-boundaries` en verde.
- RNF-7: JSON Schemas commiteados y sincronizados con Zod (test anti-drift en CI).
- RNF-8: Errores de wrappers incluyen el comando ejecutado y los últimos 2 KB de `stderr`.
- RNF-9: `pnpm sdd:validate && pnpm exec nx run-many -t lint test build` en verde al cierre de cada ciclo.

## Criterios de Aceptación

Cada CA tiene su test Vitest (archivo → caso). Ninguno renderiza video ni invoca binarios.

| CA     | Criterio verificable                                                                                                      | Test (archivo `*.spec.ts`)                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| CA-001 | `msToFrames(1000, 30)` = 30; `msToFrames(999, 30, "floor")` = 29; `msToFrames(16, 60, "ceil")` = 1                          | `units.spec.ts` → conversión y redondeos                      |
| CA-002 | `defaultFormat("reels-9x16")` = 1080×1920@30; `safeZoneFor` devuelve los márgenes de la tabla                               | `format.spec.ts`                                              |
| CA-003 | Transcripción con huecos de 300, 500 y 800 ms → solo se detectan los de 500 y 800 (`minSilenceMs: 500`, límite inclusivo)   | `silence.spec.ts` → detectSilencesFromWords                   |
| CA-004 | Silencios de palabras `[1000–1600]` y de ffmpeg `[1500–2200]` → merge `[1000–2200]`                                          | `silence.spec.ts` → mergeSilences                             |
| CA-005 | Asset de 10 000 ms con silencio `[4000–5000]` y padding 80 → `keep [0–4080]`, `cut [4080–4920]`, `keep [4920–10000]`; la unión cubre exactamente `[0, 10000]` | `prune.spec.ts`                             |
| CA-006 | Un `keep` resultante menor a `minKeepMs` se absorbe en el `cut` adyacente                                                   | `prune.spec.ts` → fragmentos mínimos                          |
| CA-007 | 5 `keep` con `every: 2, scales: [1.10, 1.15], seed: 7` → punch-ins en los keeps 2 y 4 con escalas en `[1.10, 1.15]`; misma llamada dos veces → resultado idéntico | `punch-in.spec.ts`                   |
| CA-008 | 7 palabras seguidas → grupos de ≤ 3 palabras, ninguno > 1200 ms; palabra aislada con hueco largo forma grupo propio        | `captions.spec.ts` → agrupado                                 |
| CA-009 | `emphasisKeywords: ["gratis"]` marca esa palabra; sin keywords marca la palabra más larga                                    | `captions.spec.ts` → énfasis                                  |
| CA-010 | Voz en `[1000–3000]` ms @30 fps → keyframes: `-12 dB` en 0, rampa a `-24 dB` que termina en frame 30, hold + release de vuelta a `-12 dB` que termina en frame `round((3000+250+400)/1000*30)` = 110 | `ducking.spec.ts`     |
| CA-011 | Dos rangos de voz separados por menos de `holdMs` producen un solo valle de ducking                                          | `ducking.spec.ts` → fusión                                    |
| CA-012 | `remapMsAfterCuts(6000, keeps de CA-005)` = 5160 (6000 − 840 de corte)                                                       | `remap.spec.ts`                                               |
| CA-013 | EDL de fixture (2 keeps, 1 cut, 1 punch-in, 1 broll, 1 transición, 3 caption-groups) → `Timeline` que pasa `validateTimeline` y tiene `durationFrames` = suma de keeps − frames de transición | `build-timeline.spec.ts` |
| CA-014 | `validateTimeline` detecta: asset inexistente, clip fuera de la duración del asset, solape en `aroll`, caption fuera del safe zone — un `issue` por caso con `path` | `validate-timeline.spec.ts`  |
| CA-015 | `EditDecisionList` con `punch-in` dentro de un `cut` → `safeParse` falla con el path de la decisión                          | `schemas.spec.ts` → invariantes                               |
| CA-016 | JSON Schema generado desde Zod === archivo commiteado en `schemas/` (byte a byte tras `JSON.stringify` estable)             | `schemas.spec.ts` → anti-drift                                |
| CA-017 | `parseFfprobeJson` con fixtures: mp4 1080×1920 con `rotate: 90`, jpg, wav → `MediaAsset` correctos (`kind`, dimensiones ya rotadas, `hasAudio`) | `ffprobe.spec.ts`                     |
| CA-018 | `parseSilenceDetect` sobre stderr de fixture con 3 silencios (uno abierto al final del archivo) → 3 rangos, el último cerrado en `durationMs` | `silencedetect.spec.ts`             |
| CA-019 | `parseWhisperCppJson` y `parseFasterWhisperJson` sobre fixtures del mismo audio → `Transcription` con igual cantidad de palabras y diferencia por palabra ≤ 20 ms | `whisper-parsers.spec.ts`      |
| CA-020 | `normalizeVoice` con `FixtureRunner` → segunda pasada incluye `measured_I`, `measured_TP`, `measured_LRA`, `measured_thresh` de la primera y `I=-14:TP=-1:LRA=11` | `loudnorm.spec.ts`         |
| CA-021 | `resolveBinaries` prioriza variables de entorno sobre `PATH` y lanza `BinaryNotFoundError` con el nombre del binario faltante | `binaries.spec.ts`                                           |
| CA-022 | `CommandFailedError` incluye comando, args y `stderr` truncado a 2 KB                                                         | `runner.spec.ts`                                              |
| CA-023 | `timelineToSequenceProps` de la Timeline de CA-013 → una entrada por clip con `from`/`durationInFrames` correctos y transiciones asociadas a los pares de clips correctos | `sequence-props.spec.ts` |
| CA-024 | `transitionTiming({timing: spring, damping: 200}, 30)` → `springTiming` con `durationInFrames` igual a `transition.durationFrames`; `linear` → `linearTiming` | `transition-timing.spec.ts` |
| CA-025 | `captionLayout(safeZoneFor(9:16), format)` → caja dentro de `[left, width−right] × [top, height−bottom]`                     | `caption-layout.spec.ts`                                      |
| CA-026 | `punchInStyle({scale: 1.15, translateX: 0, translateY: 0})` → `transform: "scale(1.15) translate(0px, 0px)"` con `transformOrigin` según `anchor` | `punch-in-style.spec.ts` |
| CA-027 | Smoke manual documentado: `pnpm nx run composition-remotion:smoke` renderiza la Timeline de ejemplo a MP4 1080×1920@30 de la duración esperada (fuera de CI) | README de la lib + `tools` script   |

## Ciclos planificados

| Ciclo      | Lib                        | Alcance                                                                                                   | Definition of Done                                                              |
| ---------- | -------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `cycle-01` | `libs/timeline-core`       | Scaffold (`scaffold-nx`), schemas Zod + JSON Schema commiteado, todas las funciones puras de la tabla, fixtures de EDL | CA-001 → CA-016 en verde, cobertura ≥ 85%, contexto `sdd/context/libs/timeline-core/` creado |
| `cycle-02` | `libs/media-local`         | Scaffold, `CommandRunner` + `FixtureRunner`, wrappers y parsers, fixtures reales grabadas                  | CA-017 → CA-022, README con matriz de binarios y variables de entorno           |
| `cycle-03` | `libs/composition-remotion` | Scaffold React lib, componentes de pistas, `ArollSeries` con transiciones, helpers puros, `renderTimeline`, smoke script | CA-023 → CA-027, `remotion studio` abre la composición de ejemplo        |

Los tres ciclos son secuenciales (regla "un ciclo a la vez"). Cada uno cierra con
`pnpm sdd:validate && pnpm exec nx run-many -t lint test build` en verde y su fragmento aditivo de contexto.

## Riesgos y decisiones abiertas

- **Resueltas el 2026-09-07** (ver "Evidencia y decisiones"): motor Whisper = whisper.cpp con Metal en
  Apple Silicon; ducking = ganancia relativa `-24 dB` con base `-12 dB`; Remotion en licencia
  gratuita por uso personal (revisar solo si el producto se comercializa).
- **Memoria en el render:** 16 GB compartidos entre Chrome Headless Shell (Remotion), ffmpeg y el
  modelo Whisper. Regla operativa: transcribir **antes** de renderizar, nunca en paralelo, y renderizar
  con `concurrency` acotada (Remotion elige por CPU; el smoke fija `--concurrency=4`).
- **Safe zones:** los márgenes por preset son aproximaciones de las UIs actuales de Instagram/TikTok;
  se dejan configurables y se validan visualmente en 003.
- **Alias de imports:** el repo hoy usa `@shared-utils` en `tsconfig.base.json`; `scaffold-nx` define
  en `cycle-01` si las libs nuevas siguen ese patrón o el scope `@video-maker/*`, y se aplica a las tres.
