# Architect — Cycle 3: Core Composition & Media Pipeline Engine (`libs/composition-remotion`)

> **Input:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-03/functional.md
> **Output:** sdd/specs/spec-e-burgos-001-core-composition-media-pipeline/cycles/cycle-03/architect.md
> **Generado por:** sdd-architect

---

## 0. Alcance de este documento

`cycle-03` crea `libs/composition-remotion`: la lib React 19 + Remotion 4 que convierte una
`Timeline` de `@video-maker/timeline-core` en frames y, por una entrada Node separada, en un MP4.

- **Cambios en schema (`sdd/schema.json`): NO APLICA.** El ciclo no crea ni modifica tablas: no
  hay base de datos en el motor. El único "schema" del ciclo es el contrato `Timeline`, que ya
  cerró `cycle-01` en Zod y JSON Schema y este ciclo **consume sin modificar**.
- **Contratos de API (`sdd/api.json`): NO APLICA.** El ciclo no expone ni consume endpoints HTTP.
  La superficie del ciclo es una API de módulo TypeScript (§3 y §4), no una API REST. El servicio
  HTTP que envuelve `renderTimeline` es `spec-005` (`apps/render-api`).

Por lo tanto no se toca `sdd/schema.json` ni `sdd/api.json`; la trazabilidad del ciclo vive en
este documento, en `tasks.json` y en el fragmento aditivo de contexto que escribe el reviewer.

Referencias de API de Remotion 4 verificadas contra la documentación vigente (Context7,
`/remotion-dev/remotion`, 2026-09-07): `TransitionSeries`, `springTiming`, `linearTiming`,
`fade`, `slide`, `TransitionPresentation`, `OffthreadVideo`, `calculateMetadata`, `bundle`,
`selectComposition`, `renderMedia`, `staticFile`.

---

## 1. Decisiones técnicas

### D-01 · Alias y registro del proyecto

Alias público **`@video-maker/composition-remotion`** en `tsconfig.base.json → paths`, apuntando a
`./libs/composition-remotion/src/index.ts` (consumo por source, sin bundler), igual que
`@video-maker/timeline-core` y `@video-maker/media-local`. Se agrega **una segunda entrada** para la
superficie Node:

```json
"@video-maker/composition-remotion": ["./libs/composition-remotion/src/index.ts"],
"@video-maker/composition-remotion/render": ["./libs/composition-remotion/src/render.ts"]
```

Justificación: `src/index.ts` tiene que poder cargarse en un browser (lo importará el `Player` de
`spec-006`) y `src/render.ts` importa `@remotion/bundler`/`@remotion/renderer`, que son Node puro.
Un único barrel obligaría a los consumidores de browser a arrastrar el renderer. Dos entradas
declaradas son la forma más barata de separarlas sin inventar un build de subpaths.

### D-02 · Generador y overlay SDD

```bash
pnpm nx g @nx/react:lib libs/composition-remotion \
  --bundler=none --unitTestRunner=vitest --style=none --linter=eslint \
  --component=false --no-interactive
```

Overlay obligatorio después de generar (mismo ajuste que `cycle-01` y `cycle-02`):

- **Revisar el diff de `nx.json`.** Si el generador vuelve a registrar el plugin `@nx/vitest`
  (target `test` inferido en modo **watch**, que cuelga `nx run-many -t test`) o `@nx/eslint/plugin`
  (duplica el `lint` explícito), **quitarlos**. Los plugins que deben quedar son exactamente los
  tres actuales: `@nx/js`, `@nx/react`, `@nx/vite`.
- `project.json` con tags `["scope:engine", "type:ui"]` y **todos los targets explícitos**:

```json
{
  "name": "composition-remotion",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/composition-remotion/src",
  "projectType": "library",
  "tags": ["scope:engine", "type:ui"],
  "targets": {
    "lint": { "executor": "@nx/eslint:lint" },
    "test": {
      "executor": "nx:run-commands",
      "options": { "command": "vitest run --coverage --passWithNoTests", "cwd": "libs/composition-remotion" }
    },
    "build": {
      "executor": "nx:run-commands",
      "outputs": ["{workspaceRoot}/dist/out-tsc/libs/composition-remotion"],
      "options": { "command": "tsc -p tsconfig.lib.json", "cwd": "libs/composition-remotion" }
    },
    "studio": {
      "executor": "nx:run-commands",
      "options": { "command": "remotion studio src/remotion-entry.ts", "cwd": "libs/composition-remotion" }
    },
    "smoke": {
      "executor": "nx:run-commands",
      "options": { "command": "node -r @swc-node/register ./src/smoke.ts", "cwd": "libs/composition-remotion" }
    }
  }
}
```

`build` es `tsc -p tsconfig.lib.json` (typecheck + `.d.ts`), no un bundler: Vitest no typechequea y
`--bundler=none` deja el proyecto sin ningún gate de tipos. Esto cierra el follow-up 3 de
`cycle-01` (`--bundler=none` **con** target `build`), replicado ya por `media-local`.

`studio` y `smoke` son **manuales**: no están en `lint test build`, que es el comando de
verificación del repo (`pnpm exec nx run-many -t lint test build`). Ningún flujo automatizado los
invoca — es la garantía mecánica de RN-13/RNF-3, no una convención escrita.

El registro CJS `node -r @swc-node/register` en `smoke` es obligatorio: el hook ESM
(`--import @swc-node/register/esm-register`) rompe por interop en este repo (lección de `cycle-01`),
igual que en el target `schemas` de `timeline-core`.

### D-03 · `package.json` propio de la lib, sin redeclarar Remotion

La lib lleva un `package.json` mínimo y privado — es el **único** proyecto del repo que lo necesita:

```json
{ "name": "@video-maker/composition-remotion", "version": "0.0.0", "private": true }
```

Justificación: Remotion determina su "root" por el `package.json` más cercano al entry point, y de
ese root cuelgan `public/` y `remotion.config.ts`. Sin este archivo, el root de Remotion sería la
raíz del monorepo y el `public/` de la lib terminaría en `<repo>/public`, mezclado con el de
`apps/web`.

**No se declaran dependencias acá.** Las cinco versiones exactas de Remotion viven **solo** en el
`package.json` raíz (D-04); duplicarlas es la forma más fácil de romper la regla de versión única.
La resolución de `remotion` sube por el árbol de directorios hasta `<repo>/node_modules`, que es
donde pnpm las instala. **Prohibido** agregar `"type": "module"`: ningún `package.json` del repo lo
tiene y el registro CJS de `@swc-node/register` depende de eso.

### D-04 · Versiones de Remotion: exactas, únicas, sin `^`

En el `package.json` raíz, sección `dependencies`:

```json
"remotion": "4.0.522",
"@remotion/transitions": "4.0.522",
"@remotion/bundler": "4.0.522",
"@remotion/renderer": "4.0.522",
"@remotion/cli": "4.0.522"
```

Cinco paquetes, **la misma versión exacta, sin rango**. Remotion exige que todos sus paquetes estén
en la misma versión: el bundle que produce `@remotion/bundler` y el renderer que lo consume
comparten protocolo interno, y un `^` que resuelva `@remotion/renderer` a un patch distinto de
`remotion` falla en tiempo de render con un error que no apunta a la causa. Un `^` también permite
que dos `pnpm install` en máquinas distintas resuelvan versiones distintas — inaceptable para un
motor cuyo contrato es "la misma Timeline produce siempre el mismo video".

`@remotion/cli` va en `dependencies` (no en `devDependencies`) por la misma regla: pnpm resuelve
`devDependencies` con el mismo algoritmo, pero mantenerlos juntos hace que la verificación
"las cinco comparten versión" sea un solo `grep`.

`@remotion/player` **no se instala en este ciclo** (es peer de `spec-006`).

Hechos verificados por el orquestador y asumidos por este diseño: ningún paquete de Remotion tiene
scripts de instalación, y el compositor nativo llega como `optionalDependencies` por plataforma —
pnpm lo instala sin tocar `onlyBuiltDependencies`. **`pnpm-workspace.yaml` no se modifica.** Si
contra lo esperado pnpm bloqueara un script de `@remotion/compositor-*`, recién ahí se agrega a
`onlyBuiltDependencies` explicando el motivo en el commit (TASK-001 lo contempla).

Chrome Headless Shell **no se descarga en `pnpm install`**: Remotion lo resuelve la primera vez que
corre un render real. Como ningún test ni target de CI llama a `renderMedia`, nunca se descarga en
CI (RN-13, CA-18).

Dev dependencies nuevas: `jsdom` y `@testing-library/react` (con su peer explícita
`@testing-library/dom`, obligatoria desde la v16 de testing-library), con `^` — no son parte del
contrato de render y no requieren pin exacto.

### D-05 · Separación browser / Node: dos entradas y un entry point de Remotion

| Archivo                | Entorno              | Contenido                                                        | En el barrel |
| ---------------------- | -------------------- | ---------------------------------------------------------------- | ------------ |
| `src/index.ts`         | browser + Node       | componentes + helpers puros + tipos                              | **es** el barrel |
| `src/render.ts`        | Node                 | `renderTimeline`, `RenderTimelineError`, tipos de opciones       | no           |
| `src/remotion-entry.ts`| bundle de Remotion   | única línea con `registerRoot(RemotionRoot)`                     | no           |
| `src/smoke.ts`         | Node, manual         | corre `renderTimeline` sobre la Timeline de ejemplo              | no           |

`src/index.ts` no puede importar, ni transitivamente, `@remotion/bundler`, `@remotion/renderer`,
`node:*`, `fs`, `path`, `child_process` ni `os`: es lo que hace que `spec-006` pueda montarlo en un
`<Player>` dentro de `apps/web`. El ESLint de la lib (D-07) lo impone mecánicamente.

**`registerRoot` no vive en `Root.tsx`.** `src/Root.tsx` exporta el componente `RemotionRoot` y
nada más; `src/remotion-entry.ts` es el único módulo que llama `registerRoot(RemotionRoot)`.
Justificación: `registerRoot` es un efecto global de módulo, y un módulo con efectos no puede ser
alcanzable desde el barrel que importa el Player. Además la convención de Remotion es que el entry
point sea `src/index.ts`, nombre que en este repo ya está tomado por el barrel público — el archivo
dedicado evita la colisión sin renombrar el barrel.

### D-06 · Tipos auxiliares derivados: no se toca `timeline-core`

`libs/timeline-core/src/index.ts` **no exporta** `ClipTransform`, `ClipFit`, `CaptionClipWord`,
`CaptionClipBox` ni `TransitionTiming`, y RNF-6 + `@nx/enforce-module-boundaries` prohíben el import
profundo (`@video-maker/timeline-core/src/schemas/...`). Este ciclo **no modifica el barrel de
`timeline-core`** (evita tocar una lib cerrada y su test anti-drift): los tipos que faltan se
derivan por indexed access de los que sí están exportados, en `src/helpers/timeline-types.ts`:

```ts
import type { CaptionClip, TimelineTransition, VideoClip } from '@video-maker/timeline-core';

export type ClipTransform = VideoClip['transform'];
export type ClipFit = NonNullable<VideoClip['fit']>;
export type CaptionWord = CaptionClip['words'][number];
export type CaptionBox = NonNullable<CaptionClip['box']>;
export type TransitionKind = TimelineTransition['kind'];
export type TransitionDirection = NonNullable<TimelineTransition['direction']>;
export type TimelineTiming = TimelineTransition['timing'];
```

Estos alias son un detalle de implementación: se re-exportan desde `src/index.ts` solo `CaptionBox`
y `TransitionDirection`, que aparecen en firmas públicas.

Sí están exportados y se usan directo: `Timeline`, `TimelineSchema`, `VideoClip`, `AudioClip`,
`CaptionClip`, `TimelineTransition`, `MediaAsset`, `OutputFormat`, `SafeZone`, `PunchInAnchor`,
`GainKeyframe`, `AssetId`, `ClipId`, `Frame`, `Fps`, `Ms`, `Db`, `buildTimeline`,
`validateTimeline`, `defaultFormat`, `safeZoneFor`, `msToFrames`.

### D-07 · ESLint de la lib

`libs/composition-remotion/eslint.config.mjs` extiende el raíz y agrega, sobre `src/**/*.{ts,tsx}`
excluyendo specs, `src/render.ts` y `src/smoke.ts`:

| Regla                      | Contenido                                                                                       | Por qué                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `no-explicit-any`          | `error`                                                                                          | RNF-1                                                       |
| `no-restricted-globals`    | `Date`, `process`                                                                                | RNF-4: un frame se calcula desde `frame`, no desde el reloj  |
| `no-restricted-properties` | `Math.random`                                                                                    | RNF-4: determinismo                                          |
| `no-restricted-imports`    | patterns `node:*`, `fs`, `path`, `child_process`, `os`, `@remotion/bundler`, `@remotion/renderer` | D-05: el barrel tiene que cargar en un browser               |

`react`, `react-dom`, `remotion` y `@remotion/transitions` están **permitidos** en toda la lib — es
la diferencia explícita contra `timeline-core`, que los prohíbe.

Bloque adicional para `src/render.ts` y `src/smoke.ts`: se levanta `no-restricted-imports`
(`node:*`, `fs`, `path` y los dos paquetes Node de Remotion son exactamente su razón de ser) y se
mantienen `no-explicit-any` y `no-restricted-properties`.

En el `eslint.config.mjs` **raíz** se agrega la constraint que falta para el tag nuevo:

```js
{ sourceTag: 'type:domain', onlyDependOnLibsWithTags: [] },
{ sourceTag: 'type:util',   onlyDependOnLibsWithTags: ['type:domain'] },
{ sourceTag: 'type:ui',     onlyDependOnLibsWithTags: ['type:domain'] },
{ sourceTag: '*',           onlyDependOnLibsWithTags: ['*'] },
```

Sin esa fila, `type:ui` caería en el comodín `*` y la lib podría importar `media-local` sin que
nadie lo note. `composition-remotion` **no consume `media-local`**.

### D-08 · Vitest: `jsdom`, alias de `timeline-core` y cobertura acotada

`libs/composition-remotion/vite.config.ts` (nombre real del archivo — ver §7 "Correcciones al
planner"):

```ts
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/composition-remotion',
  plugins: [react()],
  resolve: {
    alias: {
      '@video-maker/timeline-core': fileURLToPath(
        new URL('../timeline-core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: false,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/libs/composition-remotion',
      include: ['src/helpers/**/*.ts', 'src/transitions/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

Tres decisiones dentro de este archivo:

1. **`resolve.alias` es obligatorio, no opcional.** Es la lección de `cycle-02`: Vitest no lee los
   `paths` de `tsconfig.base.json`. Esta lib importa **valores** de `timeline-core`
   (`TimelineSchema`, `buildTimeline`, `safeZoneFor`, `defaultFormat`, `msToFrames`), así que sin el
   alias `lint` y `build` quedan verdes y **toda** spec revienta con `ERR_MODULE_NOT_FOUND`. TASK-001
   cierra con al menos un spec que importa un valor de `timeline-core`, para que el fallo aparezca
   en el scaffold y no cuatro tasks después.
2. **`environment: 'jsdom'`** aunque ningún test de este ciclo monte un componente: los helpers
   devuelven `CSSProperties` y el entorno queda listo para los tests de layout que traiga `spec-003`
   sin volver a tocar la config.
3. **La cobertura mide solo `src/helpers/**` y `src/transitions/**` (`.ts`).** El umbral de RNF-2
   (≥ 80 %) es sobre "los helpers puros de `composition-remotion`", no sobre la lib entera. Los
   componentes (`.tsx`), `src/render.ts`, `src/smoke.ts`, `src/Root.tsx` y `src/__fixtures__/**`
   quedan fuera del `include`, porque medirlos exigiría montar Remotion o renderizar — justo lo que
   RN-13 prohíbe. Como el `include` ya los excluye, el umbral global de 80 % se aplica exactamente
   al conjunto que la spec pide, sin thresholds por glob.

Corolario de forma para `src/transitions/`: la matemática pura del whip-pan vive en
`whip-pan-style.ts` (medida) y el componente de presentación en `whip-pan.tsx` (no medido, `.tsx`
queda fuera del `include`).

### D-09 · Estrategia de assets: `staticFile()` por defecto, `file://` como escape hatch

`MediaAsset.path` de `timeline-core` es lo que devuelve `probeMedia`: la ruta del archivo en la
máquina del creador, típicamente **absoluta**. `staticFile()` de Remotion **rechaza rutas absolutas
por contrato** (su implementación lanza `TypeError` ante `/Users`, `/home`, `/tmp`, `C:`…), así que
no puede ser el canal general. La resolución vive en una única función pura:

```ts
export function assetSrc(asset: MediaAsset): string;
```

| `asset.path`                          | Resultado                                              |
| ------------------------------------- | ------------------------------------------------------ |
| `http://…` / `https://…` / `file://…` | se devuelve tal cual                                   |
| absoluta (`/…` o `C:\…`)              | URL `file://` con cada segmento codificado             |
| relativa (`example/aroll.mp4`)        | `staticFile(path)` — resuelve dentro del `public/` |

**El camino soportado y verificado de este ciclo es el relativo + `staticFile()`**: la Timeline de
ejemplo (D-11) usa rutas relativas y el smoke de CA-027 renderiza por ese camino. La rama `file://`
existe para que `spec-005`/`tools/render-cli` puedan renderizar el metraje real del creador sin
copiar gigabytes a `public/`, y se declara **no verificada en este ciclo**: si Chrome bloqueara la
carga de sub-recursos `file://` durante el render, el fallback documentado en el README es apuntar
`publicDir` al directorio de assets (opción `publicDir` de `bundle()`/`renderMedia()`, expuesta en
`RenderTimelineOptions`) y usar rutas relativas en la `Timeline`.

`assetSrc` es una función de string a string: se testea sin render y sin filesystem, y **no importa
`node:path`** (el barrel es browser-safe) — la construcción del `file://` es manipulación de string.

### D-10 · `remotion.config.ts`

`libs/composition-remotion/remotion.config.ts`, en la raíz de la lib (los targets `studio` y `smoke`
corren con `cwd: libs/composition-remotion`, que es donde el CLI busca el config):

```ts
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setConcurrency(4);
Config.setChromiumOpenGlRenderer('angle');
```

- `setConcurrency(4)` es la misma cota que fija el smoke por CLI: es la mitigación del riesgo de
  memoria (16 GB compartidos entre Chrome Headless Shell, ffmpeg y el modelo Whisper). Dejar que
  Remotion elija por CPU en una M2 abre 8–10 pestañas de Chrome y satura la RAM.
- `setVideoImageFormat('jpeg')` reduce el pico de memoria por frame frente a PNG y no aporta
  transparencia que este pipeline necesite.
- `remotion.config.ts` **solo afecta al CLI y al studio**; `renderMedia()` no lo lee. Por eso la
  concurrencia se pasa también explícita en `renderTimeline` (D-13) — el config no es la fuente de
  verdad del render programático.

### D-11 · Timeline de ejemplo propia, construida con `buildTimeline`

Cierra el follow-up 1 de `cycle-01`: `timeline-core` no exporta sus fixtures desde el barrel y el
import profundo está prohibido, así que **esta lib arma la suya**, con los mismos números de CA-013.

- `src/__fixtures__/example-edl.ts` — el `EditDecisionList` de CA-013 (2 `keep`, 1 `cut`, 1
  `punch-in` escala 1.15 anchor `center`, 1 `broll-overlay` `cover`, 1 `transition` `fade`/`spring`
  de 300 ms, 3 `caption-group`) y los tres `MediaAsset` (A-roll video 10 000 ms, B-roll imagen,
  música 120 000 ms). **Diferencia deliberada contra la fixture de `timeline-core`:** se agrega una
  decisión `duck` `{ startMs: 1000, endMs: 3000, gainDb: -24 }` dentro de `keep-0001`. Sin ella
  `planDucking` devuelve `automation: []` y la pista de música nunca ejercita la automatización
  (CA-9). La decisión `duck` no altera la pista de A-roll: `durationFrames` sigue siendo **265**.
- `src/__fixtures__/example-timeline.ts` — `buildExampleTimeline(preset)`, que llama
  `buildTimeline(edl, assets, { assetId: 'music-bed-01' })` con `format = defaultFormat(preset)` y
  devuelve la `Timeline`. `preset` ∈ `'reels-9x16' | 'youtube-16x9'` cubre los dos formatos que
  `Root.tsx` registra (CA-11). Un test de TASK-001 verifica que ambas pasan `validateTimeline`.

Rutas de los assets de ejemplo: **relativas** (`example/aroll.mp4`, `example/broll.jpg`,
`example/music.mp3`) → rama `staticFile()` de D-09, resolviendo en
`libs/composition-remotion/public/example/`. Esos tres binarios **no se commitean** (gitignore de
`libs/composition-remotion/public/`); el README trae los tres comandos `ffmpeg` que los generan
sintéticamente (`testsrc2`, `color`, `sine`) con las duraciones que la fixture declara. Así CA-027
es ejecutable en cualquier máquina con ffmpeg y el repo no engorda.

Sobre el follow-up 2 de `cycle-01` (música más corta que la Timeline): **este ciclo no introduce
estrategia de loop ni de fade**. La música de ejemplo dura 120 000 ms contra 8 833 ms de Timeline, y
`renderTimeline` corre `validateTimeline` antes de bundlear (D-13): si el asset de música fuera más
corto, el error es `CLIP_EXCEEDS_ASSET` con `path`, antes de encender Chrome. La estrategia de loop
la define `spec-004` (audio-mix-mastering), que es quien mezcla de verdad.

### D-12 · La automatización de ganancia gana sobre `clip.gainDb` en la pista de música

`planDucking` emite keyframes de ganancia **absoluta** en dB cuyo plateau es `music.baseGainDb`
(−12 dB), y `buildTimeline` escribe **ese mismo valor** en `musicClip.gainDb`. Aplicar los dos
multiplicaría las atenuaciones: el plateau sonaría a −24 dB y el valle a −48 dB.

Regla: **si `timeline.audioMix.automation` no está vacía, la pista de música se reproduce con
`volume={(f) => volumeAtFrame(automation, f)}` y `clip.gainDb` se ignora; si está vacía, con
`gainDbToVolume(clip.gainDb)` constante.** La pista de voz siempre usa `gainDbToVolume(clip.gainDb)`
(la automatización es de la música, RN-8/RN-9). Verificable sin render: sobre la Timeline de
ejemplo, `volumeAtFrame(automation, 0) = 0.2512` (−12 dB) y `volumeAtFrame(automation, 60) = 0.0631`
(−24 dB).

### D-13 · `renderTimeline`: puertos inyectables y validación previa

`renderTimeline` recibe sus tres operaciones de Remotion por parámetro, con un default de
producción — mismo patrón que `CommandRunner` en `media-local` ("todo I/O externo entra por
parámetro, nunca se instancia dentro"). Consecuencias:

- `render.spec.ts` pasa dobles y verifica **los argumentos** que se le arman a
  `bundle`/`selectComposition`/`renderMedia`, sin ejecutar un render (CA-18, RNF-3).
- El default de producción hace `await import('@remotion/bundler' | '@remotion/renderer')`
  **dentro** de cada función, no en el top-level del módulo. Así una spec que inyecta dobles nunca
  carga los paquetes nativos de Remotion, y la suite completa de las tres libs sigue por debajo de
  los 20 s de RNF-3. (`@swc-node/register` transpila el `import()` dinámico a `require` y ambos
  paquetes son CJS: el smoke funciona igual.)

`renderTimeline` corre `validateTimeline(timeline)` **antes** de bundlear y falla con
`RenderTimelineError('INVALID_TIMELINE', issues)` si hay violaciones: es 10 s de validación pura
contra varios minutos de render que iban a producir basura.

Códigos de `RenderTimelineError`: `INVALID_TIMELINE` | `BUNDLE_FAILED` | `COMPOSITION_NOT_FOUND` |
`RENDER_FAILED`. Cada uno conserva la causa original en `cause`, siguiendo RNF-8. CE-7 (Chrome
Headless Shell ausente) llega como `RENDER_FAILED` con el mensaje de Remotion intacto, que ya nombra
el binario faltante y el comando para instalarlo; la lib **no intenta descargarlo** y ninguna ruta
automatizada llega hasta acá.

### D-14 · `licenseKey: 'free-license'`

`renderMedia` se llama con `licenseKey: 'free-license'`, declarando la elegibilidad al uso personal
gratuito que la spec ya decidió en "Evidencia y decisiones". Es una línea que evita una ambigüedad
de licenciamiento y se revisa solo si el producto se comercializa.

### D-15 · `OffthreadVideo` con `trimBefore`, no con `startFrom`

`startFrom`/`endAt` están **deprecados desde 4.0.319**, renombrados a `trimBefore`/`trimAfter`. Con
el pin en 4.0.522 se usa `trimBefore`, en **frames**. La conversión desde el contrato de la Timeline
(que habla en ms) la hace `timelineToSequenceProps` una sola vez:
`trimBefore = msToFrames(clip.trimStartMs, fps)`. Los componentes no convierten unidades — reciben
frames y los pasan.

### D-16 · El `anchor` del punch-in no viaja en la `Timeline` (gap conocido)

`punchInStyle` recibe el `anchor` como segundo parámetro porque CA-026 lo exige, pero
`buildTimeline` **descarta** `PunchInDecision.anchor` al construir `VideoClip.transform` (que solo
lleva `scale`, `translateX`, `translateY`). En consecuencia `ArollSeries` invoca `punchInStyle` con
el default `'center'`, que es el anchor de la fixture CA-013 y el default de `planPunchIns` — el
video de este ciclo sale correcto.

Propagar el anchor hasta `VideoClip` es un **cambio de contrato de `timeline-core`** (schema Zod +
JSON Schema commiteado + test anti-drift): fuera de alcance acá. Queda anotado como follow-up para
la spec que necesite anchors distintos de `center` (`spec-002` o `spec-003`).

---

## 2. Estructura de `src/**` y asignación por task

```
libs/composition-remotion/
├─ package.json                       D-03                              TASK-001
├─ project.json                       D-02                              TASK-001 (+ smoke: TASK-007)
├─ tsconfig.json / .lib.json / .spec.json  §6                           TASK-001
├─ vite.config.ts                     D-08                              TASK-001
├─ eslint.config.mjs                  D-07                              TASK-001
├─ remotion.config.ts                 D-10                              TASK-006
├─ README.md                                                            TASK-001 (mínimo) → TASK-007 (CA-027)
├─ public/example/                    binarios no versionados (D-11)    TASK-001 (.gitignore + README)
└─ src/
   ├─ index.ts                        barrel público browser-safe       TASK-001 (vacío) → TASK-007 (final)
   ├─ render.ts                       renderTimeline (Node)             TASK-001 (vacío) → TASK-007
   ├─ render.spec.ts                  dobles, sin render real           TASK-007
   ├─ smoke.ts                        smoke manual, concurrency 4       TASK-007
   ├─ remotion-entry.ts               registerRoot(RemotionRoot)        TASK-006
   ├─ Root.tsx                        RemotionRoot: 9:16 + 16:9         TASK-006
   ├─ __fixtures__/
   │  ├─ example-edl.ts               EDL de CA-013 + duck + assets     TASK-001
   │  └─ example-timeline.ts          buildExampleTimeline(preset)      TASK-001 (9:16) → TASK-006 (16:9)
   ├─ helpers/
   │  ├─ timeline-types.ts            tipos derivados (D-06)            TASK-001
   │  ├─ asset-src.ts                 assetSrc (D-09)                   TASK-002
   │  ├─ timeline-to-sequence-props.ts                                  TASK-002
   │  ├─ sequence-props.spec.ts       CA-023                            TASK-002
   │  ├─ transition-timing.ts / .spec.ts    CA-024                      TASK-003
   │  ├─ punch-in-style.ts / .spec.ts       CA-026                      TASK-003
   │  ├─ caption-layout.ts / .spec.ts       CA-025                      TASK-003
   │  └─ audio-gain.ts / .spec.ts     gainDbToVolume, volumeAtFrame     TASK-003
   ├─ transitions/
   │  ├─ whip-pan-style.ts / .spec.ts matemática pura (medida)          TASK-005
   │  ├─ whip-pan.tsx                 TransitionPresentation propia     TASK-005
   │  └─ presentation-for.ts / .spec.ts  fade | slide | whipPan         TASK-005
   └─ components/
      ├─ timeline-composition.tsx     + calculateMetadata               TASK-006
      ├─ aroll-series.tsx             TransitionSeries                  TASK-005
      ├─ broll-track.tsx                                                TASK-004
      ├─ audio-track.tsx                                                TASK-004
      └─ caption-track.tsx                                              TASK-004
```

**Nota de paralelismo (lección de `cycle-02`).** TASK-004 declara `depends_on: [TASK-001, TASK-003]`
pero consume el `SequencePropsPlan` que produce TASK-002. No es un conflicto: **el tipo está
congelado en §3 de este documento**, así que TASK-004 programa contra la firma sin esperar la
implementación. Lo mismo vale para TASK-005 respecto de `timelineToSequenceProps`. Los archivos de
TASK-002 y TASK-003 son disjuntos (`asset-src.ts` + `timeline-to-sequence-props.ts` vs. los otros
cuatro helpers), así que corren en paralelo sin zona común. La infraestructura compartida
(`timeline-types.ts`, fixtures, config) está toda en TASK-001, serializada.

---

## 3. Firmas TypeScript: helpers puros

### 3.1 `timelineToSequenceProps(timeline)` — TASK-002, CA-023

```ts
import type {
  AssetId, AudioClip, CaptionClip, ClipId, Db, Fps, Frame, MediaAsset,
  Ms, Timeline, TimelineTransition, VideoClip,
} from '@video-maker/timeline-core';
import type { CaptionBox, CaptionWord, ClipFit, ClipTransform, TransitionDirection, TransitionKind, TimelineTiming } from './timeline-types';

export interface VideoSequenceProps {
  clipId: ClipId;
  assetId: AssetId;
  src: string;
  kind: MediaAsset['kind'];
  from: Frame;
  durationInFrames: number;
  trimStartMs: Ms;
  trimBefore: Frame;
  transform: ClipTransform;
  fit: ClipFit;
  muted: boolean;
}

export interface AudioSequenceProps {
  clipId: ClipId;
  assetId: AssetId;
  src: string;
  from: Frame;
  durationInFrames: number;
  trimStartMs: Ms;
  trimBefore: Frame;
  gainDb: Db;
  volume: number;
  fadeInFrames: Frame | null;
  fadeOutFrames: Frame | null;
}

export interface CaptionSequenceProps {
  clipId: ClipId;
  from: Frame;
  durationInFrames: number;
  words: readonly CaptionWord[];
  emphasisIndex: number | null;
  box: CaptionBox | null;
}

export interface ArollTransitionPlan {
  betweenClipIds: readonly [ClipId, ClipId];
  kind: TransitionKind;
  direction: TransitionDirection | null;
  durationInFrames: number;
  timing: TimelineTiming;
}

export interface SequencePropsPlan {
  fps: Fps;
  width: number;
  height: number;
  durationInFrames: number;
  aroll: readonly VideoSequenceProps[];
  arollTransitions: readonly ArollTransitionPlan[];
  broll: readonly VideoSequenceProps[];
  voice: readonly AudioSequenceProps[];
  music: readonly AudioSequenceProps[];
  captions: readonly CaptionSequenceProps[];
  unresolvedAssetIds: readonly AssetId[];
}

export function timelineToSequenceProps(timeline: Timeline): SequencePropsPlan;
```

Reglas de mapeo:

- `from` y `durationInFrames` se copian **tal cual** de `clip.from` y `clip.durationFrames`: la
  Timeline ya está en frames, la lib no recalcula tiempos (RN-1, RN-2).
- `trimBefore = msToFrames(clip.trimStartMs, timeline.format.fps)` (D-15). `trimStartMs` se conserva
  para trazabilidad y para los tests.
- `src = assetSrc(asset)` con el `MediaAsset` que resuelve `clip.assetId` en `timeline.assets`.
- `fit = clip.fit ?? 'cover'`; `muted = clip.muted ?? false`.
- `volume = gainDbToVolume(clip.gainDb)` en `voice` y en `music` (para `music`, el componente lo
  reemplaza por la automatización cuando existe — D-12).
- `box = clip.box ?? null`. **`timelineToSequenceProps` no llama a `captionLayout`**: mantiene
  TASK-002 y TASK-003 disjuntas. El `CaptionTrack` resuelve `box ?? captionLayout(...)`.
- `arollTransitions` conserva `betweenClipIds` como par ordenado `[saliente, entrante]`, exactamente
  como lo emite `buildTimeline`; `ArollSeries` matchea por ese par, nunca por índice.
- **CE-1:** un `clip.assetId` que no resuelve en `timeline.assets` **no lanza**: el clip se omite de
  su pista y el id se acumula en `unresolvedAssetIds`. El resto de las pistas se sigue viendo.
- Función pura: no lee reloj, entorno, ni filesystem; misma `Timeline` → mismo `SequencePropsPlan`.

### 3.2 `transitionTiming(transition, fps)` — TASK-003, CA-024

```ts
import { linearTiming, springTiming } from '@remotion/transitions';
import type { TransitionTiming as RemotionTiming } from '@remotion/transitions';
import type { Fps, TimelineTransition } from '@video-maker/timeline-core';

export function transitionTiming(transition: TimelineTransition, fps: Fps): RemotionTiming;
```

```ts
// timing.type === 'spring'
springTiming({
  config: { damping: timing.damping, stiffness: timing.stiffness, mass: timing.mass },
  durationInFrames: transition.durationFrames,
});

// timing.type === 'linear'
linearTiming({ durationInFrames: transition.durationFrames });
```

- `durationInFrames` es **siempre** `transition.durationFrames`, sin reinterpretar (RN-3). Pasarlo
  explícito en el caso `spring` es lo que fuerza a Remotion a estirar el resorte a esa cantidad
  exacta de cuadros en vez de derivar la duración de la física.
- El caso `linear` **no** pasa `easing`: sin easing, `linearTiming` es velocidad constante, sin el
  rebote del resorte (RN-3).
- `fps` es parte de la firma por contrato de la spec; el timing de Remotion se expresa en frames y
  no lo necesita para el cálculo. Se usa como guarda: `durationFrames` mayor que la duración de
  cualquiera de los dos clips es un dato inválido y se recorta al mínimo de ambos, con el mismo
  criterio de `buildTimeline` (`Math.max(1, …)`).
- `transition.kind` **no interviene acá**: el timing y la presentación son ejes independientes. Un
  `kind` desconocido o `light-leak` no llega nunca a esta función como problema — resuelve
  `presentationFor` (RN-4, CE-2).

### 3.3 `punchInStyle(transform, anchor?)` — TASK-003, CA-026

```ts
import type { CSSProperties } from 'react';
import type { PunchInAnchor } from '@video-maker/timeline-core';
import type { ClipTransform } from './timeline-types';

export function punchInStyle(transform: ClipTransform, anchor?: PunchInAnchor): CSSProperties;
```

```ts
{
  transform: `scale(${transform.scale}) translate(${transform.translateX}px, ${transform.translateY}px)`,
  transformOrigin: TRANSFORM_ORIGIN_BY_ANCHOR[anchor ?? 'center'],
}
```

| `anchor`     | `transformOrigin` | Criterio                                                                  |
| ------------ | ----------------- | ------------------------------------------------------------------------- |
| `center`     | `50% 50%`         | default                                                                   |
| `top`        | `50% 0%`          | acerca conservando el borde superior                                      |
| `face-hint`  | `50% 33%`         | la cara suele caer en el tercio superior; se valida visualmente en `spec-003` |

Los números **se interpolan tal cual**, sin `toFixed`, sin redondeo y sin normalizar (RN-5): con
`{ scale: 1.15, translateX: 0, translateY: 0 }` el resultado es exactamente
`"scale(1.15) translate(0px, 0px)"` — la igualdad literal que pide CA-026.

### 3.4 `captionLayout(safeZone, format)` — TASK-003, CA-025

```ts
import type { OutputFormat, SafeZone } from '@video-maker/timeline-core';
import type { CaptionBox } from './timeline-types';

export function captionLayout(safeZone: SafeZone, format: OutputFormat): CaptionBox;
```

```ts
{
  x: safeZone.left,
  y: safeZone.top,
  width: Math.max(0, format.width - safeZone.left - safeZone.right),
  height: Math.max(0, format.height - safeZone.top - safeZone.bottom),
}
```

Invariante que el test verifica en ambos ejes y en ambos formatos (RN-6):
`x ≥ left`, `y ≥ top`, `x + width ≤ width − right`, `y + height ≤ height − bottom`.

La forma es idéntica a `safeZoneBox` de `buildTimeline`, y eso es deliberado: `CaptionClip.box` que
viene en la Timeline y `captionLayout` tienen que dar el **mismo** resultado. Un test lo compara
sobre la Timeline de ejemplo — si `timeline-core` cambiara su cálculo, el ciclo se entera.

### 3.5 `gainDbToVolume(db)` y `volumeAtFrame(automation, frame)` — TASK-003

```ts
import type { Db, Frame, GainKeyframe } from '@video-maker/timeline-core';

export function gainDbToVolume(db: Db): number;
export function volumeAtFrame(automation: readonly GainKeyframe[], frame: Frame): number;
```

- `gainDbToVolume(db) = clamp(10 ** (db / 20), 0, 1)`. Referencias: `0 dB → 1`, `−12 dB → 0.2512`,
  `−24 dB → 0.0631`. El clamp superior existe porque una ganancia positiva en la Timeline
  amplificaría por encima de 1 y Remotion la trata como distorsión.
- `volumeAtFrame`: keyframes ordenados por `frame`; `frame` anterior al primero → `gainDb` del
  primero; posterior al último → `gainDb` del último; entre dos → **interpolación lineal en dB** y
  después `gainDbToVolume`. Interpolar en dB (no en volumen lineal) es lo que reproduce fielmente
  las rampas de attack/release que `planDucking` calculó en dB.
- `automation` vacía → devuelve `1`; el componente decide qué hacer con eso (D-12).
- Sin `interpolate` de Remotion: la función es pura y se testea sin montar nada.

### 3.6 `assetSrc(asset)` — TASK-002 (D-09)

```ts
import type { MediaAsset } from '@video-maker/timeline-core';
export function assetSrc(asset: MediaAsset): string;
```

### 3.7 `whipPanStyle(...)` y `presentationFor(...)` — TASK-005

```ts
import type { CSSProperties } from 'react';
import type { TransitionPresentationComponentProps } from '@remotion/transitions';
import type { TransitionDirection, TransitionKind } from '../helpers/timeline-types';

export type PresentationDirection = 'entering' | 'exiting';

export function whipPanStyle(
  direction: TransitionDirection,
  presentationDirection: PresentationDirection,
  presentationProgress: number,
  maxBlurPx?: number,
): CSSProperties;
```

Semántica (pura, determinista, testeable en `progress` = 0, 0.5 y 1):

- **Eje:** `from-left` / `from-right` → `translateX`; `from-top` / `from-bottom` → `translateY`.
- **Desplazamiento**, en porcentaje del lado (no en px: así no necesita las dimensiones de la
  composición). Para `from-left`: entrante `(progress − 1) × 100 %` (de −100 % a 0);
  saliente `progress × 100 %` (de 0 a +100 %). `from-right` invierte el signo; `from-top` y
  `from-bottom` son lo mismo sobre el eje Y.
- **Desenfoque de movimiento:** `blur = maxBlurPx × sin(π × progress)` con `maxBlurPx = 24` por
  default — 0 en los dos extremos, máximo en el medio. Es lo que distingue un whip-pan de un slide.
- Devuelve `{ transform, filter }` como `CSSProperties`.

```ts
export type WhipPanProps = { direction: TransitionDirection; maxBlurPx?: number };

export function whipPan(props: WhipPanProps): TransitionPresentation<WhipPanProps>;

export type ArollPresentation =
  | ReturnType<typeof fade>
  | ReturnType<typeof slide>
  | ReturnType<typeof whipPan>;

export function presentationFor(
  kind: TransitionKind,
  direction: TransitionDirection | null,
): ArollPresentation;
```

| `kind`                      | Presentación                                                    |
| --------------------------- | ---------------------------------------------------------------- |
| `fade`                      | `fade()`                                                         |
| `slide`                     | `slide({ direction })`, o `slide()` si `direction` es `null`     |
| `whip-pan`                  | `whipPan({ direction: direction ?? 'from-right' })`              |
| `light-leak`                | `fade()` — degradación documentada de este ciclo (RN-4)          |
| cualquier otro (defensivo)  | `fade()` — nunca queda un corte sin transición visible (CE-2)    |

El tipo unión `ArollPresentation` evita el `any` que tendría un `TransitionPresentation<unknown>`
genérico. `whipPan` es un `TransitionPresentation<WhipPanProps>` propio: `{ component, props }`,
donde `component` recibe `{ children, presentationDirection, presentationProgress, passedProps }` y
envuelve a `children` en un `AbsoluteFill` con `whipPanStyle(...)`.

---

## 4. Componentes: props tipadas

Reglas transversales (constitución §4, RN-1, RN-2): **sin estado propio, sin I/O, sin efectos, sin
`useState`/`useEffect`**. Entra `Timeline` (o el plan derivado), sale JSX. Nada lee reloj, entorno
ni filesystem; el único hook permitido es `useVideoConfig()` cuando el componente necesita `fps` o
dimensiones que no le llegaron por props.

### 4.1 `TimelineComposition` — TASK-006

```tsx
import type { CalculateMetadataFunction } from 'remotion';
import { TimelineSchema, type Timeline } from '@video-maker/timeline-core';

export interface TimelineCompositionProps {
  timeline: Timeline;
}

export const TIMELINE_COMPOSITION_ID = 'TimelineComposition';

export const calculateTimelineMetadata: CalculateMetadataFunction<TimelineCompositionProps> = ({ props }) => {
  const timeline = TimelineSchema.parse(props.timeline);
  return {
    durationInFrames: timeline.durationFrames,
    fps: timeline.format.fps,
    width: timeline.format.width,
    height: timeline.format.height,
    props: { timeline },
  };
};

export const TimelineComposition: React.FC<TimelineCompositionProps>;
```

- `calculateMetadata` es la **única** fuente de `durationInFrames`, `fps`, `width` y `height`: nada
  se hardcodea en el componente ni en `<Composition>` (los valores del JSX son solo el placeholder
  que Remotion exige). Un cambio de formato en la Timeline cambia el video sin tocar código.
- Valida `inputProps` con `TimelineSchema.parse` y devuelve el resultado parseado en `props`:
  cumple el principio 3 del motor ("toda entrada externa pasa por Zod"). Cuando el render viene de
  `renderTimeline`, el `inputProps` llega por JSON (`selectComposition`/`renderMedia`), así que es
  la frontera real de confianza. Un JSON inválido falla acá, con el `path` de Zod, antes de
  renderizar el primer frame.
- Árbol, en orden de apilado (de fondo a frente):
  `<AbsoluteFill>` → `ArollSeries` → `BrollTrack` → `AudioTrack` → `CaptionTrack`.
- `TimelineComposition` llama `timelineToSequenceProps(timeline)` **una sola vez** y reparte el
  `SequencePropsPlan` a cada pista, en vez de que cada pista lo recalcule.

### 4.2 `ArollSeries` — TASK-005

```tsx
export interface ArollSeriesProps {
  scenes: readonly VideoSequenceProps[];
  transitions: readonly ArollTransitionPlan[];
  fps: Fps;
}

export const ArollSeries: React.FC<ArollSeriesProps>;
```

```tsx
<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
    <OffthreadVideo src={scene.src} trimBefore={scene.trimBefore} muted
      style={punchInStyle(scene.transform)} />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={presentationFor(plan.kind, plan.direction)}
    timing={transitionTiming(plan, fps)} />
  …
</TransitionSeries>
```

- Entre `scenes[i]` y `scenes[i+1]` se inserta una `TransitionSeries.Transition` **solo si** existe
  un plan cuyo `betweenClipIds` sea exactamente `[scenes[i].clipId, scenes[i+1].clipId]`. Nunca por
  índice: el par de ids es el contrato que emite `buildTimeline`.
- `durationInFrames` de cada `Sequence` es el `durationFrames` crudo del clip. `TransitionSeries`
  descuenta por sí mismo los frames de solape, así que el total de la serie da
  `Σ durationFrames − Σ transición` = el `durationFrames` de la Timeline. No se pre-restan frames:
  hacerlo los descontaría dos veces.
- `muted` siempre: el audio de A-roll llega por la pista `voice` (así lo construye `buildTimeline`,
  que marca `muted: true` en los clips de A-roll). Si el clip fuera un asset sin video
  (`kind !== 'video'`), se renderiza `<Img>`.
- `punchInStyle(scene.transform)` sin reinterpretar valores (RN-5); anchor `center` por D-16.

### 4.3 `BrollTrack` — TASK-004

```tsx
export interface BrollTrackProps {
  clips: readonly VideoSequenceProps[];
}

export const BrollTrack: React.FC<BrollTrackProps>;
```

- Un `<Sequence from={clip.from} durationInFrames={clip.durationInFrames}>` por clip (RN-1).
- Dentro: `<OffthreadVideo src trimBefore muted />` si `clip.kind === 'video'`, `<Img src />` si es
  `'image'`. Un clip `kind === 'audio'` en la pista de B-roll no se renderiza (dato inconsistente,
  se ignora sin romper).
- `fit`: `cover` → `<AbsoluteFill>` con `objectFit: 'cover'`; `contain` → `objectFit: 'contain'`;
  `pip` → wrapper posicionado con `PIP_WIDTH_RATIO = 0.32` del ancho, anclado abajo a la derecha
  dentro del safe zone. Constantes del módulo, sin magia dispersa.

### 4.4 `AudioTrack` — TASK-004

```tsx
export interface AudioTrackProps {
  voice: readonly AudioSequenceProps[];
  music: readonly AudioSequenceProps[];
  automation: readonly GainKeyframe[];
}

export const AudioTrack: React.FC<AudioTrackProps>;
```

- Voz, por clip: `<Sequence from durationInFrames><Audio src trimBefore volume={clip.volume} /></Sequence>`.
  `clip.volume` ya es `gainDbToVolume(clip.gainDb)` (RN-9).
- Música, por clip:

```tsx
<Sequence from={clip.from} durationInFrames={clip.durationInFrames}>
  <Audio
    src={clip.src}
    trimBefore={clip.trimBefore}
    volume={automation.length > 0 ? (f) => volumeAtFrame(automation, f + clip.from) : clip.volume}
  />
</Sequence>
```

  El callback de `volume` recibe el frame **relativo a la `Sequence`**, y los keyframes de
  `automation` son **absolutos en la Timeline**: por eso se suma `clip.from`. Es el bug silencioso
  más probable de esta pista y por eso queda escrito acá. Nunca un volumen fijo cuando hay
  automatización (RN-8, CA-9, D-12).
- `fadeInFrames`/`fadeOutFrames` de la Timeline aún no se aplican en este ciclo (fuera de alcance:
  la mezcla es `spec-004`); se transportan en el plan y se ignoran en el componente, sin inventar
  una curva.

### 4.5 `CaptionTrack` — TASK-004

```tsx
export interface CaptionTrackProps {
  clips: readonly CaptionSequenceProps[];
  safeZone: SafeZone;
  format: OutputFormat;
}

export const CaptionTrack: React.FC<CaptionTrackProps>;
```

- Caja: `clip.box ?? captionLayout(safeZone, format)` (RN-6, CA-7). El texto se ancla al borde
  inferior de esa caja (`justifyContent: 'flex-end'`, `textAlign: 'center'`), que es donde vive un
  subtítulo, y **nunca** fuera de ella.
- Texto plano: las 1–3 palabras del clip concatenadas con espacio, en un solo `<span>` por palabra.
  La palabra en `emphasisIndex` va con `fontWeight: 800`; el resto con `fontWeight: 600`. Sin
  animación, sin resaltado de color, sin tipografía cinética (RN-7 — eso es `spec-003`).
- `fontSize = Math.round(format.height * 0.045)` (86 px en 1080×1920, 49 px en 1920×1080), color
  blanco y `textShadow` para legibilidad sobre cualquier metraje. Fuente: stack del sistema (ver
  riesgo R-3).

### 4.6 `RemotionRoot` — TASK-006

```tsx
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="TimelineComposition"
      component={TimelineComposition}
      calculateMetadata={calculateTimelineMetadata}
      defaultProps={{ timeline: buildExampleTimeline('reels-9x16') }}
      durationInFrames={265} fps={30} width={1080} height={1920}
    />
    <Composition
      id="TimelineCompositionLandscape"
      component={TimelineComposition}
      calculateMetadata={calculateTimelineMetadata}
      defaultProps={{ timeline: buildExampleTimeline('youtube-16x9') }}
      durationInFrames={265} fps={30} width={1920} height={1080}
    />
  </>
);
```

Los cuatro valores literales son placeholders que `calculateMetadata` sobrescribe (CA-11);
coinciden con lo que la fixture produce, así que el studio arranca con los números correctos aunque
todavía no haya resuelto la metadata. `src/remotion-entry.ts` es una sola línea:
`registerRoot(RemotionRoot)`.

---

## 5. `renderTimeline` y el smoke manual (TASK-007, CA-027)

```ts
import type { Timeline } from '@video-maker/timeline-core';

export const DEFAULT_RENDER_CONCURRENCY = 4;

export interface RenderTimelineOptions {
  outPath: string;
  codec?: 'h264';
  concurrency?: number;
  compositionId?: string;
  entryPoint?: string;
  publicDir?: string | null;
  onProgress?: (renderedFrames: number, totalFrames: number) => void;
}

export interface RenderTimelineResult {
  outPath: string;
  compositionId: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export type RenderTimelineErrorCode =
  | 'INVALID_TIMELINE' | 'BUNDLE_FAILED' | 'COMPOSITION_NOT_FOUND' | 'RENDER_FAILED';

export class RenderTimelineError extends Error {
  readonly code: RenderTimelineErrorCode;
  readonly issues: readonly TimelineIssue[];
}

export interface RenderTimelineDeps {
  bundleProject(input: { entryPoint: string; publicDir: string | null }): Promise<string>;
  selectTimelineComposition(input: {
    serveUrl: string; id: string; inputProps: TimelineInputProps;
  }): Promise<CompositionMetadata>;
  renderTimelineMedia(input: {
    composition: CompositionMetadata; serveUrl: string; codec: 'h264';
    outputLocation: string; concurrency: number; inputProps: TimelineInputProps;
  }): Promise<void>;
}

export const remotionRenderDeps: RenderTimelineDeps;

export function renderTimeline(
  timeline: Timeline,
  options: RenderTimelineOptions,
  deps?: RenderTimelineDeps,
): Promise<RenderTimelineResult>;
```

Secuencia:

1. `validateTimeline(timeline)`; si falla → `RenderTimelineError('INVALID_TIMELINE', issues)`
   **antes** de bundlear (D-13).
2. `bundle({ entryPoint, webpackOverride: (config) => config, publicDir })` — el `entryPoint` por
   default es `src/remotion-entry.ts` resuelto relativo a `render.ts`, no un `process.cwd()`.
3. `selectComposition({ serveUrl, id: compositionId ?? TIMELINE_COMPOSITION_ID, inputProps })` —
   `inputProps = { timeline }`, el mismo objeto que se pasa después a `renderMedia`.
4. `renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: outPath, concurrency, inputProps, licenseKey: 'free-license', onProgress })`.
5. Devuelve `RenderTimelineResult` con `width`/`height`/`fps`/`durationInFrames` **de la
   composición resuelta**, no de la Timeline de entrada: es lo que permite verificar CA-027
   comparando el resultado con `timeline.format` sin abrir el MP4.

`concurrency` default `DEFAULT_RENDER_CONCURRENCY = 4`: nunca "lo que la CPU permita" (RN-14,
CA-16). Es una constante exportada, no un número suelto.

`src/smoke.ts` (manual, fuera de CI):

```ts
const timeline = buildExampleTimeline('reels-9x16');
const result = await renderTimeline(timeline, {
  outPath: 'out/example-9x16.mp4',
  concurrency: DEFAULT_RENDER_CONCURRENCY,
});
```

y loguea `result` para que el operador compare 1080 × 1920 @ 30 y 265 frames.

README de la lib (TASK-007) — el procedimiento CA-027 paso a paso:

1. Generar los tres assets de ejemplo en `public/example/` con los comandos `ffmpeg` que el README
   trae (no están versionados).
2. **Terminar la transcripción antes de renderizar, nunca en paralelo** (RN-14, CA-15): en una M2
   de 16 GB, Chrome Headless Shell + ffmpeg + el modelo Whisper cargado a la vez agotan la memoria.
3. `pnpm nx run composition-remotion:smoke` — la primera corrida descarga Chrome Headless Shell
   (esto **nunca** pasa en CI: ningún target automatizado llama a `renderMedia`).
4. Verificar: `out/example-9x16.mp4` existe, `ffprobe` reporta 1080 × 1920 @ 30 fps y ~8,83 s
   (265 frames).
5. Límite de concurrencia del ejemplo: **4** (`--concurrency=4` / `DEFAULT_RENDER_CONCURRENCY`),
   CA-16.
6. Si falta Chrome Headless Shell y no puede descargarse, el error de Remotion lo nombra tal cual
   (CE-7); la lib no intenta instalarlo por su cuenta.

---

## 6. Configuración de TypeScript

`tsconfig.json` (referencias, igual que `timeline-core`) → `tsconfig.lib.json` + `tsconfig.spec.json`.

`tsconfig.lib.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "jsx": "react-jsx",
    "declaration": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/**/*.spec.ts", "src/**/*.spec.tsx"]
}
```

`tsconfig.spec.json` agrega `"jsx": "react-jsx"` y `"types": ["node", "vitest/globals"]` sobre los
specs.

Dos consecuencias que el implementador tiene que tener presentes:

- `exactOptionalPropertyTypes: true` es la razón por la que **todo el `SequencePropsPlan` usa `T |
  null` y no `T?`**: un campo opcional obliga a construir el objeto por spread condicional (el
  `optionalField()` de `buildTimeline`) y acá no aporta nada.
- `types: ["node"]` en `lib` porque `render.ts` y `smoke.ts` son Node; eso **no** habilita a
  importar `node:*` desde el resto de la lib — eso lo bloquea ESLint (D-07).

---

## 7. Correcciones al planner (`planner.md` / `tasks.json`)

Ninguna cambia el alcance, la dependencia entre tasks ni la estimación; son nombres de archivo y
dos archivos que el planner no listó. Se documentan acá para que el reviewer no las lea como deriva
(mismo criterio que `cycle-01` §Estructura y `cycle-02` §Estructura).

| Planner                                | Real                                                        | Motivo                                                            |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `vitest.config.ts`                     | `vite.config.ts`                                             | Convención del repo: `timeline-core` y `media-local` usan `vite.config.ts` |
| `__fixtures__/edl.fixture.ts`          | `__fixtures__/example-edl.ts`                                | Consistencia con el naming de `timeline-core` (`__fixtures__/edl.ts`) |
| `__fixtures__/timeline.fixture.ts`     | `__fixtures__/example-timeline.ts`                           | ídem                                                               |
| —                                      | `src/helpers/timeline-types.ts` (TASK-001)                   | D-06: tipos derivados, infraestructura compartida serializada       |
| —                                      | `src/helpers/asset-src.ts` + spec (TASK-002)                 | D-09: lo consume `timelineToSequenceProps`                          |
| —                                      | `src/helpers/audio-gain.ts` + spec (TASK-003)                | D-12: `gainDbToVolume` / `volumeAtFrame`, puros y medidos           |
| `src/transitions/whip-pan.ts`          | `whip-pan-style.ts` (puro, medido) + `whip-pan.tsx` (componente) | D-08: separa lo medible por cobertura de lo que necesita React |
| —                                      | `src/transitions/presentation-for.ts` + spec (TASK-005)      | mapeo `kind → presentación`, incluida la degradación `light-leak`   |
| —                                      | `src/remotion-entry.ts` (TASK-006)                           | D-05: `registerRoot` fuera del barrel y fuera de `Root.tsx`         |
| —                                      | `src/smoke.ts` (TASK-007)                                    | El target `smoke` necesita un script; el planner solo listó el target |
| —                                      | `libs/composition-remotion/public/example/.gitignore` (TASK-001) | D-11: assets de ejemplo generados, no versionados               |
| —                                      | `eslint.config.mjs` raíz (TASK-001)                          | D-07: constraint `type:ui → [type:domain]`                          |

---

## 8. Verificación de CA-023 a CA-027 con valores concretos

Todos los valores son sobre la Timeline de ejemplo `buildExampleTimeline('reels-9x16')`
(1080 × 1920 @ 30, `durationFrames` = 265).

### CA-023 — `sequence-props.spec.ts`

| Assert                                        | Valor esperado                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `plan.durationInFrames`                       | `265`                                                                           |
| `plan.aroll.length`                           | `2`                                                                             |
| `plan.aroll[0]`                               | `from: 0`, `durationInFrames: 122`, `trimStartMs: 0`, `trimBefore: 0`, `transform.scale: 1`, `muted: true` |
| `plan.aroll[1]`                               | `from: 113`, `durationInFrames: 152`, `trimStartMs: 4920`, `trimBefore: 148`, `transform.scale: 1.15` |
| `plan.arollTransitions`                       | 1 entrada, `betweenClipIds: ['aroll-0001', 'aroll-0002']`, `kind: 'fade'`, `durationInFrames: 9`, `timing.type: 'spring'` |
| `plan.broll[0]`                               | `from: 121`, `durationInFrames: 60`, `kind: 'image'`                            |
| `plan.voice.length` / `plan.music.length`     | `2` / `1` (música `from: 0`, `durationInFrames: 265`, `gainDb: -12`)            |
| `plan.captions.length`                        | `3` — `cap-0001` `from: 15, dur: 33`; `cap-0002` `from: 51, dur: 33`; `cap-0003` `from: 115, dur: 30` |
| suma de la serie de A-roll                    | `122 + 152 − 9 = 265` = `timeline.durationFrames`                               |
| CE-1                                          | Timeline con `assets` sin `broll-shot-01` → `plan.broll` vacío, `unresolvedAssetIds: ['broll-shot-01']`, `plan.aroll` intacto |
| ninguna importación de DOM/render             | el spec solo importa `timelineToSequenceProps` y la fixture                     |

### CA-024 — `transition-timing.spec.ts`

- `transitionTiming({ kind: 'fade', durationFrames: 9, timing: { type: 'spring', damping: 200, stiffness: 100, mass: 1 } }, 30)`
  → `springTiming({ config: { damping: 200, stiffness: 100, mass: 1 }, durationInFrames: 9 })`;
  `getDurationInFrames({ fps: 30 })` del timing devuelto = **9**, exactamente `durationFrames`.
- La misma transición con `timing: { type: 'linear' }` → `linearTiming({ durationInFrames: 9 })`;
  duración 9 y progreso constante (`progress(4.5) = 0.5`), sin rebote.
- `kind: 'light-leak'` y un `kind` desconocido no rompen `transitionTiming`: siguen devolviendo un
  timing válido de 9 frames (RN-4, CE-2). La degradación a `fade` la resuelve `presentationFor`,
  con su propio test.

### CA-025 — `caption-layout.spec.ts`

- 9:16 → `safeZoneFor(defaultFormat('reels-9x16')) = { top: 220, bottom: 400, left: 60, right: 140 }`
  → `captionLayout(...) = { x: 60, y: 220, width: 880, height: 1300 }`.
  Invariantes: `60 ≥ 60`, `220 ≥ 220`, `60 + 880 = 940 ≤ 1080 − 140 = 940`,
  `220 + 1300 = 1520 ≤ 1920 − 400 = 1520`.
- 16:9 → `{ top: 60, bottom: 60, left: 60, right: 60 }` → `{ x: 60, y: 60, width: 1800, height: 960 }`.
- Cross-check: `captionLayout(timeline.safeZone, timeline.format)` es igual a
  `timeline.tracks.captions[0].box` de la Timeline de ejemplo.

### CA-026 — `punch-in-style.spec.ts`

- `punchInStyle({ scale: 1.15, translateX: 0, translateY: 0 })` →
  `{ transform: 'scale(1.15) translate(0px, 0px)', transformOrigin: '50% 50%' }` — igualdad literal
  de string, sin tolerancia.
- `anchor: 'top'` → `transformOrigin: '50% 0%'`; `'face-hint'` → `'50% 33%'`.
- `{ scale: 1.1, translateX: -12.5, translateY: 8 }` →
  `'scale(1.1) translate(-12.5px, 8px)'` — el helper no redondea ni normaliza (RN-5).

### CA-9 / CA-10 (US-3-005) — `audio-gain.spec.ts`

Automatización de la Timeline de ejemplo (la que produce `planDucking` para el `duck`
`[1000, 3000]` de D-11, exactamente los keyframes de CA-010 de la spec):

```
[{ frame: 0, gainDb: -12 }, { frame: 26, gainDb: -12 }, { frame: 30, gainDb: -24 },
 { frame: 98, gainDb: -24 }, { frame: 110, gainDb: -12 }]
```

| Assert                                | Valor                                             |
| ------------------------------------- | ------------------------------------------------- |
| `volumeAtFrame(automation, 0)`        | `0.2512` (−12 dB)                                 |
| `volumeAtFrame(automation, 28)`       | `0.1259` (−18 dB, interpolación lineal en dB)     |
| `volumeAtFrame(automation, 60)`       | `0.0631` (−24 dB, fondo del valle)                |
| `volumeAtFrame(automation, 264)`      | `0.2512` (después del último keyframe)            |
| `volumeAtFrame([], 0)`                | `1`                                               |
| `gainDbToVolume(0)`                   | `1`                                               |
| voz                                   | `gainDbToVolume(0) = 1` en `from: 0, dur: 122` y `from: 113, dur: 152` |

### CA-027 — README + target `smoke` (manual, fuera de CI)

`pnpm nx run composition-remotion:smoke` → `out/example-9x16.mp4`, y
`renderTimeline` devuelve `{ width: 1080, height: 1920, fps: 30, durationInFrames: 265 }`, que es
exactamente `timeline.format` + `timeline.durationFrames` (RN-12). El README documenta el orden
transcripción → render (CA-15) y la concurrencia 4 (CA-16). Ningún `*.spec.ts` de la lib llega a
`renderMedia`: los dobles de `RenderTimelineDeps` cortan antes (CA-18, RNF-3).

---

## 9. Reglas de implementación (no negociables)

1. **Cero comentarios** en el código (regla del repo). Un nombre que no se explica solo es una señal
   de refactor, no de comentario.
2. **Cero `any`**, `unknown` incluido en firmas públicas solo si se estrecha con Zod (RNF-1).
   `ArollPresentation` y `RenderTimelineDeps` existen para no necesitar `any`.
3. **Superficie pública = `src/index.ts`**, más `src/render.ts` como segundo entry documentado
   (D-01, D-05). Los specs importan por ruta relativa, nunca desde el barrel — mismo criterio que
   `timeline-core` y `media-local`. `src/__fixtures__/**`, `src/helpers/timeline-types.ts` (salvo
   `CaptionBox` y `TransitionDirection`), `src/remotion-entry.ts`, `src/Root.tsx` y `src/smoke.ts`
   **no** se exportan.
4. **Sin I/O ni estado en componentes**: nada de `useState`, `useEffect`, `fetch`, `fs`, `Date` ni
   `Math.random`. Un componente es una función de props a JSX.
5. **La Timeline no se recalcula**: `from`, `durationFrames`, `scale` y `durationFrames` de
   transición se copian tal cual. La única conversión permitida es `msToFrames` de `timeline-core`
   para `trimBefore` (D-15).
6. **Ningún test monta Remotion, renderiza un frame, descarga Chrome ni escribe un archivo de
   video.** El único camino a un render real es el target `smoke`, manual.
7. **Cierre del ciclo:** `pnpm sdd:validate && pnpm exec nx run-many -t lint test build` en verde
   (RNF-9), cobertura ≥ 80 % sobre `src/helpers/**` y `src/transitions/**`, y `nx.json` sin plugins
   inferidos nuevos.

---

## 10. Dependencias externas

| Paquete                                                        | Versión   | Sección               | Motivo                                                  |
| -------------------------------------------------------------- | --------- | --------------------- | -------------------------------------------------------- |
| `remotion`                                                     | `4.0.522` | `dependencies`        | `Composition`, `Sequence`, `OffthreadVideo`, `Img`, `Audio`, `AbsoluteFill`, `staticFile`, `interpolate` |
| `@remotion/transitions`                                        | `4.0.522` | `dependencies`        | `TransitionSeries`, `springTiming`, `linearTiming`, `fade`, `slide`, `TransitionPresentation` |
| `@remotion/bundler`                                            | `4.0.522` | `dependencies`        | `bundle()` en `src/render.ts`                            |
| `@remotion/renderer`                                           | `4.0.522` | `dependencies`        | `selectComposition()`, `renderMedia()` en `src/render.ts` |
| `@remotion/cli`                                                | `4.0.522` | `dependencies`        | `remotion studio` (target `studio`) y `Config` de `remotion.config.ts` |
| `jsdom`                                                        | `^`       | `devDependencies`     | `environment: 'jsdom'` de Vitest                         |
| `@testing-library/react` + `@testing-library/dom`              | `^`       | `devDependencies`     | tests de layout sin render (peer obligatoria desde v16)  |

Ya presentes en el repo y reusados sin cambios: `react` / `react-dom` `^19`, `@types/react` /
`@types/react-dom` `^19`, `@vitejs/plugin-react` `^6`, `vite` `^8`, `vitest` `^4`,
`@vitest/coverage-v8`, `typescript` `~6.0`, `@swc-node/register`, `zod` `^4.5`.

Binarios locales, **solo para el smoke manual, nunca en CI**:

| Binario                 | Cómo se obtiene                                                     |
| ----------------------- | -------------------------------------------------------------------- |
| Chrome Headless Shell   | lo descarga Remotion la primera vez que se ejecuta `renderMedia`     |
| `ffmpeg`                | solo para **generar** los tres assets de ejemplo de `public/example/` |

`libs/composition-remotion` depende de **una sola** lib del repo: `@video-maker/timeline-core`
(tag `type:domain`). No depende de `media-local` ni de `shared-utils`.

---

## 11. Riesgos

| Id  | Riesgo                                                                                                                                                    | Mitigación en este ciclo                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R-1 | **Memoria en el render.** 16 GB compartidos entre Chrome Headless Shell, ffmpeg y el modelo Whisper. Con la concurrencia por defecto (por CPU) la M2 abre 8–10 pestañas y se queda sin RAM a mitad del render. | `DEFAULT_RENDER_CONCURRENCY = 4` en `renderTimeline`, `Config.setConcurrency(4)` en `remotion.config.ts`, y el README exige transcribir **antes** de renderizar, nunca en paralelo (RN-14, CA-15/CA-16). |
| R-2 | **`OffthreadVideo` no funciona en el `<Player>`** que monta `spec-006`: extrae frames vía el renderer, que en preview cae a un `<video>`, y en un Player embebido el comportamiento no es equivalente a `<Video>`. | Este ciclo usa `OffthreadVideo` porque optimiza el render (RF-12), que es su objetivo. `spec-006` va a necesitar un componente de video conmutable (`<Video>` en Player, `<OffthreadVideo>` en render). Queda como follow-up explícito para `spec-006`; no se resuelve acá para no diseñar a ciegas contra un consumidor que todavía no existe. |
| R-3 | **Fuentes del sistema en los captions.** El `CaptionTrack` usa el stack de fuentes del sistema: el studio en macOS y Chrome Headless Shell pueden resolver tipografías distintas, y el texto cambia de ancho entre preview y render. | Aceptado en este ciclo: el caption es texto plano mínimo (RN-7) y la caja del safe zone es lo único que se verifica (CA-025), no el ancho del texto. `spec-003` incorpora fuentes embebidas (`@remotion/google-fonts`) y ahí desaparece. |
| R-4 | **`file://` para assets absolutos no está verificado.** Chrome podría bloquear la carga de sub-recursos `file://` durante el render (D-09).                | El camino soportado del ciclo es relativo + `staticFile()`, que es el que ejercita el smoke. El fallback (`publicDir` apuntando al directorio de assets) está documentado en el README y expuesto como opción de `renderTimeline`. |
| R-5 | **El `anchor` del punch-in no viaja en la `Timeline`** (D-16): un anchor distinto de `center` no llega al componente.                                       | Sin impacto en este ciclo (la fixture y el default de `planPunchIns` son `center`). Follow-up de contrato para `spec-002`/`spec-003`.                              |
| R-6 | **El generador de Nx vuelve a inferir targets** (`@nx/vitest` en modo watch, `@nx/eslint/plugin` duplicado) y cuelga `nx run-many -t test` fuera de CI.      | TASK-001 revisa el diff de `nx.json` y corre `nx run-many -t lint test build` completo **antes** de dar el scaffold por bueno (lección de `cycle-01`).             |
| R-7 | **Alias de Vitest ausente** → `lint` y `build` verdes y toda spec que importe un valor de `timeline-core` revienta con `ERR_MODULE_NOT_FOUND`.               | `resolve.alias` obligatorio en `vite.config.ts` (D-08) y un spec que importa un **valor** dentro de TASK-001, para que el fallo aparezca en el scaffold (lección de `cycle-02`). |

---

## 12. Cambios en schema y contratos de API

**NO APLICA** — ver §0. Este ciclo no crea ni modifica tablas (`sdd/schema.json` sin cambios) ni
endpoints REST (`sdd/api.json` sin cambios). El contrato que consume, la `Timeline`, quedó cerrado y
versionado en `cycle-01` y **no se modifica**: los tipos que el barrel de `timeline-core` no exporta
se derivan por indexed access (D-06) en vez de tocar esa lib.
