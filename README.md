# Video Maker

Estudio de video local con un productor de IA: armás videos de **motion graphics** (guion → escenas animadas con tu
marca, voz y música) o montás **material crudo** (grabaciones cortadas, subtituladas y con locución). La
transcripción, la voz, la mezcla y el render corren en tu Mac.

*A local video studio with an AI producer: motion graphics from a script, or edits of your raw footage. Transcription,
voice, mixing and rendering run on your Mac.*

- Web, descarga y guía de uso (es / en): https://video.estebanburgos.com.ar
- Cómo funciona: https://video.estebanburgos.com.ar/como-funciona/ · [How it works](https://video.estebanburgos.com.ar/en/how-it-works/)
- Tecnología y licencias: https://video.estebanburgos.com.ar/tecnologia/ · [Technology](https://video.estebanburgos.com.ar/en/technology/)

## Qué hay en el repo

Monorepo [Nx](https://nx.dev) con pnpm, todo en TypeScript estricto.

| Ruta | Qué es |
| --- | --- |
| `apps/desktop` | App Electron para macOS Apple Silicon; arma el `.dmg` |
| `apps/web` | Web Studio (React 19): chat del productor, biblioteca, storyboard, voz, vista previa, publicación |
| `apps/render-api` | Servicio HTTP local del motor: proyectos, cola de render, montaje, voz y productor |
| `apps/motion-editor` | Editor visual de videos animados por timeline |
| `apps/docs-site` | La web pública (HTML estático, Cloudflare Pages) |
| `libs/timeline-core` | Contratos del motor (Timeline, EDL, storyboard, voz) y cálculos de edición |
| `libs/media-local` | Wrappers de ffmpeg/ffprobe/whisper-cli/síntesis de voz y mezcla de audio |
| `libs/composition-remotion` | Composición y render Remotion de una Timeline |
| `libs/auto-montage` | Ingesta, palabras clave, plan de B-roll y montaje automático |
| `libs/motion-graphics` | Motor de motion graphics: golpes, catálogo de escenas, kits de marca |
| `libs/producer-tools` | Herramientas del productor y servidor MCP |
| `libs/local-store` | Base SQLite del estudio |
| `libs/shared-utils` | Reservada para utilidades compartidas |
| `tools/render-cli` | CLI headless: carpeta de material → MP4 |
| `tools/motion-studio` | CLI de motion graphics sobre HyperFrames |

## Correrlo en desarrollo

Requisitos: Node 22+, pnpm 10 (único gestor de paquetes del repo; nunca `npm install` ni `yarn`), ffmpeg y
whisper.cpp.

```bash
pnpm install
cp .env.example .env            # completar rutas absolutas (el archivo explica cada una)
brew install ffmpeg whisper-cpp # + el modelo ggml de whisper, ver .env.example
pnpm fetch:dev-voices           # sintetizador sherpa-onnx y voces Piper
pnpm studio                     # render-api + Web Studio
```

El productor usa Claude Code (CLI `claude` con tu suscripción) u OpenRouter (tu API key).

La app de escritorio: `pnpm desktop:dist` (macOS Apple Silicon).

## Contribuir

1. Abrí un [issue](https://github.com/e-burgos/video-maker/issues) con el problema o la idea.
2. El repo usa **Spec-Driven Development**: las funcionalidades nacen de una spec en `sdd/specs/` y los arreglos se
   registran en `sdd/fixes.json`. Punto de entrada: [`sdd/context/context_prompt.md`](sdd/context/context_prompt.md)
   (también para agentes: `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`).
3. Código sin comentarios narrativos: nombres declarativos y funciones cortas.
4. Antes del PR, todo en verde:

```bash
pnpm exec nx run-many -t lint test build
pnpm sdd:validate
```

## Licencia

El código es [MIT](LICENSE) © 2026 Esteban Burgos.

Los binarios, modelos, voces, tipografías y música de terceros mantienen sus licencias (FFmpeg GPL-3.0, libvips
LGPL-3.0, espeak-ng GPL-3.0, voces CC-BY-SA / CC0 / Apache-2.0, música CC BY 4.0, tipografías OFL…):
[`apps/desktop/vendor/THIRD_PARTY_NOTICES.md`](apps/desktop/vendor/THIRD_PARTY_NOTICES.md).

**Remotion** no es software libre: es gratis para personas y empresas chicas bajo los umbrales de
[su licencia](https://www.remotion.dev/license); una empresa por encima de esos umbrales necesita una licencia de
empresa de Remotion para usar este proyecto.
