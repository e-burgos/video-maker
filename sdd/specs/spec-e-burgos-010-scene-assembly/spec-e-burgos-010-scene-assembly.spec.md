# SPEC-e-burgos-010: Scene Assembly: Huecos, Escenas Remotion y Timeline desde el Storyboard

> Estado: **draft** — esqueleto redactado al registrar el backlog generativo (2026-09-09).
> Se detalla al abrir su `cycle-01`.

## Resumen Ejecutivo

Esta spec cierra el círculo del modo generativo: convierte un storyboard con voz en un video.
Tres piezas. Primero, los **huecos de escena** en la UI: cada escena del storyboard muestra su
prompt visual y un espacio vacío donde el usuario arrastra el archivo que generó en Meta AI o
Google Flow, con **importación numerada en lote** (`01.mp4`, `02.png`… caen en la escena 1, 2, …)
para no arrastrar de a uno. Segundo, las **escenas nativas de Remotion** para todo lo que no
necesita material generado: título, texto, código y foto con Ken Burns. Tercero, y es el corazón:
un **segundo productor de `Timeline`**, `buildTimelineFromStoryboard`, hermano del `autoMontage`
que ya existe, donde la duración de cada escena la fija la voz de esa escena.

El montaje actual desde A-roll (`spec-002` / `spec-007`) no se toca: quedan dos productores de
`Timeline` para dos modos de trabajo, contra el mismo contrato de salida.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

Pedido literal del dev (2026-09-09): *"el usuario genera los visuales en herramientas externas
gratuitas y los arrastra numerados a los huecos de cada escena"*, y *"las escenas sin material se
resuelven con escenas nativas de Remotion (título, texto, código, imagen con Ken Burns)"*.

## Evidencia y decisiones

- **Evidencia (pedido del dev, 2026-09-09):** el eslabón externo devuelve **archivos sueltos con
  nombre libre**. La convención numérica (`01`, `02`, …) es la única forma barata de mapearlos a
  escenas sin pedirle al usuario que los renombre uno por uno, y es la misma numeración que el
  export de prompts de `spec-008` ya emite.
- **Evidencia (referencia analizada: "AI Code King clone with Remotion, Gemini & TTS", Ambsd):**
  las escenas de título, texto y código se resuelven **dentro de Remotion**, sin material
  generado, y son la mayoría en un video técnico.
- **Evidencia (`libs/auto-montage/src/auto-montage.ts`):** `autoMontage` ya produce
  `work/timeline.json` + `work/edl.json` con escritores propios que garantizan bytes idénticos a
  los de la CLI. El segundo productor tiene que usar **los mismos escritores**, no
  `JSON.stringify` propio.
- **Evidencia (`libs/composition-remotion`, `spec-001` y `spec-003`):** la composición ya sabe
  renderizar pistas, transiciones y captions cinéticas desde una `Timeline`. Las escenas nativas
  son componentes nuevos de esa lib, no un motor nuevo.
- **Evidencia (`sdd/memory/lessons.md`):** el alias de una lib hay que declararlo en los **tres**
  resolvedores (tsc, Vitest, `webpackOverride` de Remotion) — verde en los tres targets no prueba
  que el bundler resuelva.
- **Decisión heredada:** un tercer `kind` de job (`assemble`) en la misma cola de concurrencia 1,
  con el precedente de `spec-007` D-2 y `spec-008` D-5.

## Plan de ciclos (previsto)

| Ciclo | Fase | Flow | Qué entrega |
| --- | --- | --- | --- |
| **cycle-01** | `remotion-scenes` | `lite` | En `libs/composition-remotion`: las cuatro escenas nativas (título, texto, código, imagen con Ken Burns) con sus props tipadas, safe zones y presets tipográficos vigentes. |
| **cycle-02** | `timeline-from-storyboard` | `lite` | `buildTimelineFromStoryboard` en `libs/timeline-core`/`libs/auto-montage`, con la duración de cada escena tomada de su voz; job `kind: 'assemble'` en `apps/render-api`; contrato en `sdd/api.json`. |
| **cycle-03** | `scene-slots-studio` | `lite` | En `apps/web`: huecos por escena con drag&drop, importación numerada en lote, elección de escena Remotion cuando no hay material, y disparo del ensamblado. |

## Requisitos Funcionales previstos (RF)

- **RF-1:** `libs/composition-remotion` provee cuatro escenas nativas — `title`, `text`, `code`,
  `image-kenburns` — con props tipadas que corresponden 1 a 1 con `remotionScene` del storyboard.
- **RF-2:** La UI muestra un hueco por escena con su `visualPrompt` visible y acepta drag&drop de
  un archivo de video o imagen.
- **RF-3:** La importación en lote mapea por número de nombre de archivo (`01.*` → escena 1) y
  reporta explícitamente los archivos que no matchean ninguna escena.
- **RF-4:** `buildTimelineFromStoryboard` produce una `Timeline` válida donde la duración de cada
  escena es la de su pista de voz, y las escenas sin material caen en su escena nativa de Remotion.
- **RF-5:** El resultado se escribe con los **mismos escritores** que `autoMontage`, de modo que la
  `Timeline` producida por los dos caminos sea del mismo formato byte a byte.
- **RF-6:** Un job `kind: 'assemble'` ejecuta el ensamblado en la misma cola, con progreso por
  escena y cancelación cooperativa.
- **RF-7:** El montaje desde A-roll sigue funcionando sin cambios de contrato.

## Requisitos No-Funcionales previstos (RNF)

- **RNF-1:** Cero dependencias npm nuevas salvo justificación escrita.
- **RNF-2:** `lint test build` en verde sin warnings; cobertura por encima del piso.
- **RNF-3:** El alias de toda lib nueva se declara en los tres resolvedores y se verifica con un
  render real, no sólo con la suite.
- **RNF-4:** Sin comentarios en el código; payloads y README en inglés.

## Dependencias

- Subproyectos previstos: `apps/web`, `libs/composition-remotion`, `libs/timeline-core`,
  `libs/auto-montage`, `apps/render-api`.
- `spec-e-burgos-008-ai-storyboard` — el documento que se ensambla.
- `spec-e-burgos-009-voice-over` — la voz que fija la duración de cada escena.

## Criterios de Aceptación previstos (CA)

- **CA-001:** Un test por cada escena nativa verifica sus props y su render en el Player.
- **CA-002:** Un test verifica el mapeo numerado en lote, incluidos los archivos sin escena.
- **CA-003:** Un test verifica que la duración de cada escena sale de la voz y no de la estimación.
- **CA-004:** Un test verifica que los dos productores de `Timeline` emiten el mismo formato.
- **CA-005:** Smoke real ejecutado: de un storyboard con voz a un MP4, verificado con `ffprobe`
  contra el **stream de video** (`nb_frames`, `r_frame_rate`), nunca contra `format.duration`.
