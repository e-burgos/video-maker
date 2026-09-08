# FIX-e-burgos-001-001 — composition-remotion:smoke target cannot resolve workspace TS path aliases

| Campo         | Valor                                                     |
| ------------- | --------------------------------------------------------- |
| **ID**        | FIX-e-burgos-001-001                                      |
| **Tipo**      | BUGFIX                                                    |
| **Severidad** | high                                                      |
| **Keyword**   | [BUGFIX]                                                  |
| **Fecha**     | 2026-09-08                                                |
| **Autor**     | e-burgos                                                  |
| **Estado**    | implemented                                               |
| **Spec**      | spec-e-burgos-001-core-composition-media-pipeline         |

## Problema

`pnpm nx run composition-remotion:smoke` nunca produjo un render desde que se agregó el target en
spec-001 cycle-03. Tres causas encadenadas — cada una queda escondida detrás de la anterior hasta
que esta se resuelve:

### Causa 1 — alias de workspace mal resueltos por `@swc-node/register`

Falla en ~400 ms, antes de llegar a `bundle`:

```
Error: Cannot find module '../../libs/timeline-core/src'
Require stack:
  libs/composition-remotion/src/__fixtures__/example-timeline.ts
  libs/composition-remotion/src/smoke.ts
```

El target corre `node -r @swc-node/register ./src/smoke.ts` con `cwd: libs/composition-remotion`.
`@swc-node/register` toma `libs/composition-remotion/tsconfig.json` como proyecto y usa ese
directorio como `baseUrl`, pero los `paths` que ese tsconfig hereda de `tsconfig.base.json`
están escritos relativos a la raíz del workspace (`./libs/<lib>/src/index.ts`). Resultado:
`@video-maker/timeline-core` se reescribe a un archivo bajo
`libs/composition-remotion/libs/timeline-core/src`, que no existe.

Lección general (reusable para cualquier target `nx:run-commands` con `cwd` de proyecto): no
hereda el `paths` de `tsconfig.base.json` tal cual está escrito — hay que apuntar
`SWC_NODE_PROJECT` a un tsconfig cuyo `baseUrl` sea la raíz del workspace.

### Causa 2 — `@swc-node/register` compilando `.js` de terceros

Con la causa 1 resuelta, el smoke avanza hasta `renderTimeline` → `bundleProject` y ahí el proceso
panica:

```
thread '<unnamed>' panicked at miette-7.6.0/src/handlers/graphical.rs:1159:22:
Formatting argument out of range
```

Bisección: el panic ocurre dentro de `bundle()` de `@remotion/bundler`, incluso con un entry point
Remotion trivial → no es código propio de la lib. Sin `-r @swc-node/register`, el mismo `bundle()`
termina OK. Trazando `Module._extensions`, el último archivo que se compila antes del panic es
`~/.vscode/extensions/wallabyjs.console-ninja-*/out/buildHook/index.js`. Causa raíz:
`@swc-node/register` registra un loader para `.js` además de `.ts`/`.tsx`; el bundler de Remotion
(webpack, `rspack: false` por default) dispara una cadena de `require()` que incluye el build hook
que la extensión Console Ninja de VSCode inyecta en el proceso, ese `.js` de terceros pasa por swc
y swc panica formateando su diagnóstico.

### Causa 3 — el webpack de `@remotion/bundler` no conoce los alias del workspace

Con las causas 1 y 2 resueltas, el smoke real avanza hasta `bundleProject` y ahí webpack falla,
legible esta vez:

```
Field 'browser' doesn't contain a valid alias configuration
.../node_modules/@video-maker/timeline-core.mjs doesn't exist
...
at runWebpack (@remotion/bundler/dist/bundle.js:236)
at renderTimeline (src/render.ts:103)
```

`remotionRenderDeps.bundleProject` (en `src/render.ts`) llamaba a `bundle()` con
`webpackOverride: (config) => config` — identidad, sin alias. `getResolveConfig()` de
`@remotion/bundler` (`node_modules/@remotion/bundler/dist/shared-bundler-config.js`) no incluye
ningún mecanismo de `tsconfig-paths` ni alias para libs del workspace, solo remaps puntuales de
React/Remotion. Como `libs/timeline-core` no tiene `package.json` propio ni está symlinkeado en
`node_modules`, webpack busca `@video-maker/timeline-core` como paquete npm y se sale del repo
buscándolo. Es la misma lección que ya dejó `cycle-02` de spec-001 con `vite.config.ts`: un alias
de workspace hay que declararlo en **cada** resolvedor del stack — con Remotion son tres:
`tsconfig`, Vite y el webpack de `bundle()`.

## Justificación del bypass

El smoke es el único camino a un render Remotion real (CA-027 de spec-001); todos los targets
automatizados inyectan dobles de `RenderTimelineDeps` y jamás llaman `renderMedia`. Con el smoke
roto no hay forma de verificar que una `Timeline` renderiza de punta a punta; spec-004 lo necesita
para validar el mux final de audio y spec-005 construye el render service encima. Es un defecto de
tooling en un entregable ya cerrado: no toca API pública, ni módulos de dominio, ni contratos —
abrir un ciclo SDD completo es desproporcionado.

## Solución aplicada

tsconfig dedicado para el target `smoke`, cero dependencias nuevas: `libs/composition-remotion/tsconfig.smoke.json`
extiende `tsconfig.lib.json` y sobrescribe `baseUrl` a `../..` (raíz del workspace), que es donde
están escritos los `paths` de `tsconfig.base.json`. El target `smoke` de `project.json` inyecta
`SWC_NODE_PROJECT=./tsconfig.smoke.json` vía `options.env` de `nx:run-commands` (Nx 23.1.1 lo
soporta — confirmado en `node_modules/nx/dist/src/executors/run-commands/schema.json`, propiedad
`env`), sin necesidad de inlinear la variable en el `command`.

Alternativas descartadas:

- `tsconfig-paths` — dependencia nueva que igual necesita el mismo override de `baseUrl`; no aporta
  nada sobre la solución elegida.
- `tsx` — dependencia nueva; cambia el runtime del smoke sin necesidad real.
- `baseUrl` en `tsconfig.base.json` — arregla el síntoma pero cambia la resolución de módulos de
  TODO el monorepo (Nx 23 deliberadamente no usa `baseUrl`); blast radius desproporcionado para un
  target manual.
- `SWC_NODE_PROJECT=../../tsconfig.base.json` a secas — funciona, pero pierde las
  `compilerOptions` propias de la lib (`jsx: react-jsx`, `types: ["node"]`, etc.); frágil si el
  smoke llega a cargar un `.tsx`.

Para la causa 2: nuevo `libs/composition-remotion/src/smoke-register.cjs`, precargado en vez de
`@swc-node/register` directo. Guarda el loader nativo de Node para `.js`, registra
`@swc-node/register` (que sobrescribe `Module._extensions['.js']`) y de inmediato le devuelve a
Node ese loader nativo — dejando swc acotado a `.ts`/`.tsx`, que es todo lo que esta lib tiene.
`project.json` pasa a precargar ese módulo (`node -r ./src/smoke-register.cjs ./src/smoke.ts`)
conservando `options.env.SWC_NODE_PROJECT` de la causa 1.

Para la causa 3: `src/render.ts` declara `WORKSPACE_ALIASES` (un `Record<string, string>` con la
única dependencia de workspace de esta lib, `@video-maker/timeline-core`, resuelta a su
`src/index.ts` vía `resolve(__dirname, ...)`) y `withWorkspaceAliases`, que mergea ese alias sobre
`config.resolve.alias` sin pisar lo que Remotion ya trae. `remotionRenderDeps.bundleProject` pasa a
usar `withWorkspaceAliases` como `webpackOverride` en vez de la identidad. El tipo
`WebpackConfiguration` se importa de `@remotion/bundler` (que ya lo re-exporta desde
`override-types.d.ts`), no de `webpack` directo — evita declarar una dependencia nueva. No cambia
la firma pública de `renderTimeline`/`RenderTimelineOptions`/`RenderTimelineDeps`: los tests siguen
reemplazando `remotionRenderDeps` por dobles, sin tocar `render.spec.ts`. Solo se alias
`timeline-core`: es la única lib que `composition-remotion` consume.

### Archivos modificados

- `libs/composition-remotion/tsconfig.smoke.json` (nuevo) — extiende `tsconfig.lib.json`,
  sobrescribe `baseUrl: "../.."`.
- `libs/composition-remotion/src/smoke-register.cjs` (nuevo) — acota `@swc-node/register` a
  `.ts`/`.tsx`, devolviéndole a Node su loader nativo de `.js`.
- `libs/composition-remotion/src/render.ts` — agrega `WORKSPACE_ALIASES`/`withWorkspaceAliases` y
  los aplica como `webpackOverride` de `remotionRenderDeps.bundleProject`.
- `libs/composition-remotion/project.json` — target `smoke`: agrega
  `options.env.SWC_NODE_PROJECT: "./tsconfig.smoke.json"` y cambia el preload a
  `-r ./src/smoke-register.cjs`.
- `libs/composition-remotion/README.md` — sección "Smoke manual — CA-027 (fuera de CI)":
  documenta las tres causas y sus soluciones.
- `libs/composition-remotion/.gitignore` (nuevo) — ignora `out/`, la salida del smoke.

### Test de validación

El smoke completo (`nx run composition-remotion:smoke`) es manual y fuera de CI — `renderMedia`
nunca corre en CI (RNF-3); ningún `*.spec.ts` de la lib llega a `bundle`/`selectComposition`/
`renderMedia`. Referencia del procedimiento:
`libs/composition-remotion/README.md#smoke-manual--ca-027-fuera-de-ci`.

Verificación de resolución de módulos (paso intermedio, antes del render real):

```bash
cd libs/composition-remotion && SWC_NODE_PROJECT=./tsconfig.smoke.json node -r @swc-node/register -e \
  "const m=require('./src/render'); const f=require('./src/__fixtures__/example-timeline'); \
   console.log(Object.keys(m), Object.keys(f), JSON.stringify(f.buildExampleTimeline('reels-9x16').format))"
```

Salida obtenida:

```
[ 'DEFAULT_RENDER_CONCURRENCY', 'RenderTimelineError', 'remotionRenderDeps', 'renderTimeline' ]
[ 'buildExampleTimeline' ]
{"preset":"reels-9x16","width":1080,"height":1920,"fps":30}
```

Confirmado además que sin `SWC_NODE_PROJECT` reaparece el error original (`Cannot find module
'../../libs/timeline-core/src'`), aislando la causa al `baseUrl`.

Verificación de la causa 2 — `bundle()` con el entry point real de la lib (`src/remotion-entry.ts`,
el mismo que usa `render.ts`), con `smoke-register.cjs` precargado:

```bash
cd libs/composition-remotion && SWC_NODE_PROJECT=./tsconfig.smoke.json node -r ./src/smoke-register.cjs -e "
const { resolve } = require('node:path');
import('@remotion/bundler').then(async ({ bundle }) => {
  const url = await bundle({ entryPoint: resolve(process.cwd(), 'src/remotion-entry.ts'), webpackOverride: (c) => c, publicDir: null });
  console.log('BUNDLE OK', url);
}).catch((e) => { console.log('BUNDLE ERROR', e && e.message); process.exitCode = 1; });
"
```

**El panic de la causa 2 no reaparece** (confirmado en todas las corridas posteriores): con
`smoke-register.cjs`, Console Ninja se conecta y se desconecta del build sin que swc intente
compilarlo.

Verificación de la causa 3 — con `withWorkspaceAliases` aplicado en `render.ts`, `bundleProject`
directo (mismo entry point y `publicDir` reales que usa `renderTimeline`):

```bash
cd libs/composition-remotion && SWC_NODE_PROJECT=./tsconfig.smoke.json node -r ./src/smoke-register.cjs -e "
const { resolve } = require('node:path');
const { remotionRenderDeps } = require('./src/render');
remotionRenderDeps.bundleProject({ entryPoint: resolve(process.cwd(), 'src/remotion-entry.ts'), publicDir: resolve(process.cwd(), 'public') })
  .then((u) => console.log('BUNDLE OK', u))
  .catch((e) => { console.log('BUNDLE ERROR', e && e.message); process.exitCode = 1; });
"
```

Salida obtenida (dos corridas, reproducible):

```
BUNDLE OK /var/folders/.../T/remotion-webpack-bundle-qByg4Q
BUNDLE OK /var/folders/.../T/remotion-webpack-bundle-jryMca
```

Verificación final — **el smoke completo se corrió de verdad, una vez** (2026-09-08, por el
orquestador). `memory_pressure` reportaba nivel 2 de forma sostenida, pero sin ningún proceso
`ffmpeg`/`whisper`/Chrome Headless activo y con ~42 % de memoria libre: es el estado basal de la
máquina, no un pico del otro carril, así que se procedió.

```bash
pnpm nx run composition-remotion:smoke
```

Salida literal:

```
{
  outPath: 'out/example-9x16.mp4',
  compositionId: 'TimelineComposition',
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 265
}

 NX   Successfully ran target smoke for project composition-remotion

  Run duration:      53.2s
```

Verificación del entregable con `ffprobe`:

```
codec_name=h264
width=1080
height=1920
r_frame_rate=30/1
nb_frames=265
duration=8.833333
codec_name=aac
sample_rate=48000
channels=2
```

Coincide exactamente con lo que el README documenta para CA-027 (1080×1920 @ 30 fps, 265 frames,
8,83 s). **Es el primer render real que produce este repo**: CA-027 pasa de "procedimiento
documentado, nunca ejecutado" a verificado.

`libs/composition-remotion/.gitignore` (nuevo, una línea `out/`) se agrega en el mismo fix: hasta
ahora el smoke nunca había producido salida, así que el MP4 de 9,2 MB no tenía dónde ser ignorado.
Es el sexto archivo del fix, uno más que el máximo del FIX GATE; queda justificado en
`process_note` de `sdd/fixes.json`.

`pnpm nx run-many -t lint test build --projects=composition-remotion`: lint, test y build en verde;
244 tests, cobertura 96.77% statements / 93.16% branches (piso: 96.77% / 93.16%, sin regresión;
verificado antes y después de la causa 3).
`pnpm sdd:validate`: OK, 18 archivos válidos (1 warning preexistente sobre `memory/journal`, no
relacionado a este fix).

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX

---
