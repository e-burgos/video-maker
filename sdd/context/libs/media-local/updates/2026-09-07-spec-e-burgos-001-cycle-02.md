# spec-e-burgos-001-core-composition-media-pipeline cycle-02 — 2026-09-07

## Estado

- Lib creada y completa para su alcance de `cycle-02`: `CommandRunner` inyectable
  (`ExecaCommandRunner` real / `FixtureCommandRunner` para tests), jerarquía de errores tipados
  (`MediaLocalError` → `BinaryNotFoundError`, `CommandFailedError`, `UnparseableOutputError`),
  resolución de binarios (`resolveBinary`/`resolveBinaries`) y, por comando, un wrapper de I/O +
  un parser puro: `probeMedia`/`parseFfprobeJson`, `detectSilencesWithFfmpeg`/`parseSilenceDetect`,
  `measureLoudness`/`parseLoudnormJson`, `normalizeVoice` (dos pasadas),
  `extractAudioForTranscription`, `transcribeWithWhisperCpp`/`parseWhisperCppJson` y
  `parseFasterWhisperJson`. CA-017..CA-022 en verde; 155 tests, cobertura 98.03 % statements /
  94.77 % ramas, sin ejecutar un solo binario.
- `resolve: context_prompt.md "Estado: en construcción — cycle-02 abierto"` → `cycle-02` cerrado;
  sigue `cycle-03` (`libs/composition-remotion`). La lib vuelve a tocarse en `spec-004`
  (audio-mix-mastering), que reusa `normalizeVoice` y agrega el mux final.
- `resolve: constitution.md §3 "src/__fixtures__/ — salidas reales grabadas de cada binario"` →
  las fixtures de `ffmpeg/` y `whisper/` **no** son capturas reales: se reconstruyeron a mano a
  partir del formato documentado en `architect.md` §6 porque el entorno de implementación no tenía
  `ffmpeg`, `ffprobe` ni `whisper-cli` (ver `## Qué sigue`).

## Estructura

- Árbol real de `src/`: `runner/` (`command-runner.ts`, `execa-command-runner.ts`,
  `fixture-command-runner.ts`), `errors/` (uno por error + `media-local-error.ts`), `binaries/`,
  `fs/` (`binary-lookup.ts`, `read-text-file.ts`), `clock.ts`, `ffprobe/`, `ffmpeg/`, `whisper/`,
  `__fixtures__/` (`load-fixture.ts` + `ffprobe/`, `ffmpeg/`, `whisper/`).
- **Corrección vs. `architect.md` §2:** `buildLoudnormFilter` NO vive en `normalize-voice.ts` sino
  en `src/ffmpeg/build-loudnorm-filter.ts`. Ubicarlo donde decía el architect creaba el único ciclo
  de imports de la lib (`measure-loudness ↔ normalize-voice`); el archivo propio lo elimina.
- **Todo I/O externo entra por parámetro, nunca se instancia dentro de un wrapper.** Cuatro puertos
  inyectables, cada uno con su default de producción: `CommandRunner` (sin default: es argumento
  obligatorio de todo wrapper), `Clock` → `systemClock` (`probeMedia`, para `probedAt`),
  `ReadTextFile` → `nodeReadTextFile` (`transcribeWithWhisperCpp`, lee el `.json` que deja
  `whisper-cli -of`) y `BinaryLookup` → `nodeBinaryLookup` (`resolveBinary`). En tests se pasa un
  doble de cada uno; por eso la suite no depende de qué binarios tenga instalados la máquina.
- **`vite.config.ts` de la lib necesita `resolve.alias` para `@video-maker/timeline-core`**
  apuntando a `../timeline-core/src/index.ts`. `tsc` resuelve el alias por
  `tsconfig.base.json → paths`, pero Vitest/Vite no leen esa sección: sin el alias, cualquier spec
  que importe un **valor** (`MediaAssetSchema`, `TranscriptionSchema`, `normalizeTranscriptionWords`)
  falla en runtime con `ERR_MODULE_NOT_FOUND` aunque `lint` y `build` estén verdes. Regla para
  libs nuevas del repo: el alias se agrega en los DOS lados.
- ESLint de la lib confina el I/O mecánicamente, por directorio: `execa` solo en
  `src/runner/execa-command-runner.ts`; `node:fs`/`node:fs/promises` solo en `src/fs/**`,
  `src/__fixtures__/**` y `*.spec.ts`; `child_process` prohibido en todos lados (los comandos pasan
  siempre por `CommandRunner`); `Date` solo en `src/clock.ts`; `process` y `Math.random` prohibidos
  en producción (el entorno entra como parámetro: `resolveBinaries(env)`). Boundaries Nx:
  `type:util` → `onlyDependOnLibsWithTags: ['type:domain']` (nueva restricción agregada al
  `eslint.config.mjs` raíz en este ciclo).
- `src/index.ts` exporta exactamente lo listado en `architect.md` §3, ni un símbolo más: los
  schemas Zod de las salidas externas, las fixtures y los helpers internos
  (`FFPROBE_ARGS`, `truncateStderr`, `groupTokensIntoWords`, `extractTrailingJsonObject`,
  `DEFAULT_WHISPER_LANGUAGE`, los defaults de `extract-audio`) son detalle de implementación. Los
  specs importan por ruta relativa, nunca desde el barrel (mismo criterio que `timeline-core`).

## Dependencias

- Runtime nuevo en el `package.json` raíz: **`execa` ^10.0.1** (única dependencia nueva del ciclo).
  `zod` ya estaba desde `cycle-01`.
- Alias `@video-maker/media-local` agregado a `tsconfig.base.json → paths`. La lib no tiene
  `package.json` propio: se consume por source.
- **Binarios externos que la lib invoca (nunca los descarga ni los instala):** `ffmpeg` ≥ 6.0
  (`FFMPEG_PATH`), `ffprobe` ≥ 6.0 (`FFPROBE_PATH`), `whisper-cli` ≥ 1.7 (`WHISPER_CPP_PATH`) y el
  modelo `ggml-*.bin` (`WHISPER_MODEL_PATH`). Precedencia: la variable de entorno gana sobre `PATH`
  y, si apunta a una ruta inválida, **no** cae al `PATH` — lanza `BinaryNotFoundError` de una.
  `WHISPER_MODEL_PATH` no tiene fallback a `PATH` (un modelo no es ejecutable). La resolución es un
  lookup puro de filesystem (`access` + `stat`), nunca `<binario> --version`: la versión mínima no
  se valida en código, solo en el smoke manual del README. Alcance POSIX: sin `PATHEXT` ni `.exe`.
- **Faster-Whisper no es un binario que la lib ejecute**: solo se interpreta su formato JSON
  (`parseFasterWhisperJson`), para comparar equivalencia con whisper.cpp (CA-019). No tiene variable
  de entorno.

## Qué sigue

- **Las fixtures de `ffmpeg/` y `whisper/` están reconstruidas a mano, no capturadas.** El README
  (§ "Fixtures: procedencia y cómo regrabarlas") trae el comando exacto de cada una. Regrabarlas en
  una máquina con los binarios instalados, manteniendo los mismos valores numéricos — son los que
  arrastran los `toEqual` exactos de CA-018/CA-019/CA-020. Dos diferencias conocidas contra una
  corrida real, a verificar al regrabar: `loudnorm.stderr.txt` incluye el resumen legible
  (`Input Integrated:` …) que `print_format=json` no emite, y `ffprobe/image.json` declara
  `format_name: "jpeg_pipe"` cuando `ffprobe foo.jpg` sobre archivo suele reportar `image2` (el
  parser acepta ambos).
- **`ExecaCommandRunner.run()` es la única ruta de código sin test** (40 % de ramas del archivo):
  cubrirla exigiría ejecutar un proceso real, prohibido por RNF-3 y por la regla 7 de
  `architect.md`. `mapExecaResult`, que concentra toda la lógica de traducción de resultados y
  errores de execa, sí está cubierto al 100 % con dobles. La verificación del wrapper real es el
  smoke manual del README.
- `spec-004` (audio-mix-mastering) vuelve sobre esta lib: reusa `normalizeVoice`/`DEFAULT_VOICE_TARGET`
  y necesita el mux final multi-pista, que este ciclo no cubre.
- `cycle-03` (`libs/composition-remotion`) no consume `media-local`: consume `timeline-core`.
