# Constitución — tools/motion-studio

> Versión 1.1 | Última actualización: consolidación de fragmentos | Fecha: 2026-10-13

## 1. Propósito

- **Tipo:** tool Node ejecutable (CLI headless) + plantillas HTML versionadas
- **Rol en el sistema:** produce videos de motion graphics (presentaciones, explicativos, instructivos)
  sobre HyperFrames. No monta material grabado: eso es `render-cli`/`render-api` con Remotion.

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22), `node:util parseArgs`, Vitest 4 con puertos inyectables.
- `@video-maker/media-local` para la voz (sherpa-onnx) y la transcripción (whisper-cli); `@video-maker/motion-graphics`
  para toda la lógica (`MotionDependencies.assetsRoot` = `MOTION_STUDIO_ASSETS`, default `libs/motion-graphics/assets`).
- HyperFrames `0.8.139` desde `node_modules` (`hyperframes@0.8.139` en el `package.json` raíz; sin `npx`).
  **Cero dependencias npm propias.**
- Adaptador de IA: Claude CLI (`CLAUDE_CLI_PATH`, default `claude`; `MOTION_STUDIO_MODEL`, default `sonnet`), siempre
  sin `ANTHROPIC_API_KEY` (suscripción) y con `--setting-sources '' --strict-mcp-config --no-session-persistence`
  (sin eso carga plugins/hooks/MCP del usuario, ~180k tokens por llamada).
- Plantillas: HTML + CSS + GSAP 3.14 local (`assets/vendor`), fuentes locales (Outfit, Geist, Geist Mono).

## 3. Reglas

- Una plantilla registra **una** timeline GSAP pausada en `window.__timelines["<composition-id>"]`.
- Nada de `tl.call` para cambiar texto o estado: capas con fundido (el render busca cuadros salteados).
- Animar transformaciones (`x`, `y`, `scale`), nunca `left`/`top` (el lint lo rechaza).
- La marca vive en `templates/<marca>/_brand/`; un video nunca hardcodea colores fuera de esos tokens.
- Toda música lleva su crédito visible si la licencia lo pide (CC BY).

## 4. Estructura y comandos

- CLI fina sobre los pasos de `libs/motion-graphics`: `nx run motion-studio:cli -- <init|voice|plan|compose|render|storyboard|auto> ...`.
  `storyboard <archivo> <proyecto>` compone desde el catálogo (copia runtime, marca, imágenes y música);
  `auto <brief.json> <proyecto>` genera el storyboard con la IA, lo escribe y compone (imágenes desde `images/` al
  lado del brief; reporte de escenas, reparación, tokens y costo; ~$0,40–0,60 y 3–6 min por storyboard de 60 s con
  `sonnet`); `plan` acepta `music: null` (grilla de 120 BPM sin audio); `voice --only id,id` rehace sólo esas líneas
  y conserva el resto de `words.json`; `init` copia el runtime y la marca de la lib y después el kit a mano.
- `src/deps/claude-cli-ask-agent.ts` (cwd en `mkdtemp`, schema sin `$schema`/`$id`, exige `structured_output`),
  `src/deps/hyperframes-cli.ts`, `src/deps/node-motion-dependencies.ts` (lee marcas del usuario de `BRANDS_ROOT`,
  default `<cwd>/brands`, además de las incluidas); `composeFromStoryboard` compartido por `storyboard` y `auto`.
- `templates/displayads/` con `_brand/brand/` (CSS `--da-*`, `kit.js`, `tutorial.css`), las plantillas `presentacion`,
  `counter-15`, `core-pro` y `_music`; fuentes e imágenes en `assets/brand/`, GSAP y sfx en `assets/runtime/` dentro del
  proyecto. Proyectos de trabajo en `.motion-work/` (gitignoreado); `media/` es la raíz del estudio y cada carpeta ahí
  se importa como proyecto.
- La skill `video-maker-material-contract` cubre los dos modos (§0 elige material crudo o motion; §12 documenta el
  modo motion). display-ads la consume por symlink y suma su skill `video-maker-request`.
- `render` y el job `motion` renderizan `ui-walkthrough` sin ajustes.

## 5. Pendientes vigentes

- `wordAt()` de la plantilla estima por posición en el guion cuando Whisper no reconoce la palabra (avisa por
  consola); si se repite, que `voice` guarde también el alineamiento forzado contra el guion.
- La salida de `auto` es mayormente razonamiento (16–29k tokens): un `--effort` configurable puede bajar costo y
  tiempo; medirlo antes de cambiar el default.
- Producir los videos pendientes de display-ads con la skill nueva (promos y reels en modo motion).

## Lecciones específicas

- Piper es estocástico: generar N tomas y elegir la mejor por transcripción; una frase de marca suelta la arruina Whisper (integrarla en una oración).
- La grilla de golpes se ajusta sobre `hyperframes beats` y se descarta con confianza < 0,2.
