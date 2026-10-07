# spec-e-burgos-019-motion-studio — cycle-01 · plan (lite)

> Módulo: motion-studio | Subproyecto: tools/motion-studio (nuevo) | Fecha: 2026-10-07
> Flow: **lite** — perfil `solo`; el dev pidió el trabajo punta a punta con merge directo al terminar.

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C1-01 | `tools/motion-studio` sigue la forma de `tools/render-cli`: TypeScript estricto, `node:util parseArgs`, puertos inyectables, Vitest sin binarios | Mismo patrón probado; cero dependencias npm propias (D-06) |
| D-C1-02 | Cuatro comandos: `voice` (tomas + transcripción), `plan` (golpes + escenas + ducking → `timeline.json`), `compose` (plantilla → `index.html`), `render` (`npx hyperframes render`) | Cada paso deja un artefacto en disco y se puede rehacer solo |
| D-C1-03 | La plantilla lee tiempos por palabra (`words.json`) para animar cuando la voz nombra algo, y la grilla para cortar en golpe | Sincronía con la voz y con la música a la vez |
| D-C1-04 | Todo cambio de texto o estado en la animación es una capa con fundido, nunca un `tl.call` | El render captura cuadros en paralelo y salteados: un callback no se repite al buscar hacia atrás |
| D-C1-05 | Las tomas de esta entrega se generaron con el mismo modelo Piper vía `piper-tts` (Python) porque el contenedor no tiene sherpa-onnx ni whisper-cli; el comando `voice` usa el stack de `media-local` en la máquina del dev | Declarado para que la evidencia diga qué corrió dónde |

## Historias

- **US-019-101 — Cortes al golpe.** CA: con `beat-sync` cada escena empieza en un golpe de la grilla y las anclas
  caen en el compás más cercano; con `--no-beat-sync` las escenas siguen a la voz; la música baja bajo cada frase.
- **US-019-102 — Voz que se entiende.** CA: de N tomas queda la de mayor puntaje contra el guion, con su
  transcripción y tiempos por palabra.
- **US-019-103 — Videos de DisplayAds.** CA: presentación e instructivos renderizados a 1080p30 con la marca
  (sin violeta ni Inter, logos de `logo-final`), voz es_AR y crédito de la música; `hyperframes lint` sin errores.
- **US-019-104 — Skills disponibles.** CA: el plugin de HyperFrames queda habilitado para el repo y la skill
  `motion-studio` explica el flujo.

## Tasks (detalle en tasks.json)

TASK-001 grilla · TASK-002 escenas y ducking · TASK-003 mejor toma · TASK-004 plantilla · TASK-005 CLI ·
TASK-006 plantillas DisplayAds y render · TASK-007 plugin y skill · TASK-008 cierre.
