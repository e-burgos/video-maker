# TASK-003 — notas del implementador (movidas desde planner.md por el orquestador)


- **TASK-003** creó `libs/media-local/src/clock.ts` (`Clock`, `systemClock`) y
  `libs/media-local/src/__fixtures__/load-fixture.ts` (`readFixture`, D-15) porque `probeMedia`
  (D-11) y las fixtures de `ffprobe.spec.ts` los necesitan de entrada; el `tasks.json` original solo
  los listaba como parte de la estructura de §2 del architect.md sin asignarlos a ninguna task
  puntual. Son infraestructura compartida: TASK-004/005/006/007 los van a reusar tal cual
  (`readFixture` para sus propias fixtures; `Clock`/`systemClock` no aplica a ffmpeg/whisper, que no
  producen timestamps propios).
- **`libs/media-local/vite.config.ts` necesitó `resolve.alias` para `@video-maker/timeline-core`.**
  Es el primer archivo de esta lib que importa un **valor** (no solo un `type`) desde
  `@video-maker/timeline-core` (`MediaAssetSchema`). `tsc` resuelve el alias vía
  `tsconfig.base.json → paths` para el build, pero Vitest/Vite no leen esa sección sin un plugin o
  alias explícito — sin esto, cualquier test que importe un schema/valor de `timeline-core` falla en
  runtime con `ERR_MODULE_NOT_FOUND` aunque `build` y `lint` pasen. Se agregó:
  ```ts
  resolve: {
    alias: {
      '@video-maker/timeline-core': fileURLToPath(new URL('../timeline-core/src/index.ts', import.meta.url)),
    },
  },
  ```
  Los imports de solo-tipo (como los que ya usa TASK-004 en `src/ffmpeg/`) no lo necesitan porque
  `verbatimModuleSyntax` los borra en la transformación. TASK-005/007, que si importan valores de
  `timeline-core` (`VoiceTarget`, `TranscriptionSchema`/`normalizeTranscriptionWords`), van a
  depender de este mismo alias — no hace falta que lo vuelvan a agregar, ya queda en el
  `vite.config.ts` de la lib.

