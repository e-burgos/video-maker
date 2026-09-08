# Constitución — libs/media-local

> Versión 1.0 | Última actualización: cycle-02 (spec-e-burgos-001) | Fecha: 2026-09-07
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** lib Node (TypeScript, solo servidor)
- **Rol en el sistema:** única puerta del motor hacia los binarios locales (ffprobe, ffmpeg,
  whisper-cli). Ejecuta comandos a través de un runner inyectable y convierte su salida a los
  contratos de `@video-maker/timeline-core`. Ninguna otra lib invoca binarios.

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22)
- `execa` ^10.0.1 para el runner real (única dependencia runtime nueva); `zod` para validar salidas externas
- Vitest 4 con fixtures grabadas/reconstruidas; cero binarios en CI

## 3. Estructura y patrones

- `src/index.ts` única superficie pública, exportando exactamente los schemas Zod de las salidas
  externas, las fixtures y los helpers públicos — nada de detalle de implementación
  (`FFPROBE_ARGS`, `truncateStderr`, `groupTokensIntoWords`, etc. no se exportan)
- `src/runner/` — `CommandRunner`, `ExecaCommandRunner`, `FixtureCommandRunner`, errores tipados
- `src/errors/` — `MediaLocalError` → `BinaryNotFoundError`, `CommandFailedError`, `UnparseableOutputError`
- `src/binaries/` — resolución de rutas por variables de entorno y `PATH`
- `src/fs/` — `binary-lookup.ts`, `read-text-file.ts` (los ports de filesystem)
- `src/clock.ts` — el reloj inyectable (`Clock`)
- `src/ffprobe/`, `src/ffmpeg/`, `src/whisper/` — un wrapper (I/O vía runner) + un parser puro por
  comando. `buildLoudnormFilter` vive en `src/ffmpeg/build-loudnorm-filter.ts` (no en
  `normalize-voice.ts`: ubicarlo ahí crea el único ciclo de imports de la lib,
  `measure-loudness ↔ normalize-voice`)
- `src/__fixtures__/` — `load-fixture.ts` + `ffprobe/`, `ffmpeg/`, `whisper/`. Las de `ffprobe/` son
  capturas reales; las de `ffmpeg/` y `whisper/` están **reconstruidas a mano** contra el formato
  documentado (el entorno de implementación no tenía los binarios instalados)

## 4. Convenciones propias

- **Parser puro separado del wrapper**: el wrapper arma argumentos y ejecuta; el parser recibe texto y
  devuelve un contrato validado. Los tests cubren el parser con fixtures y el wrapper con
  `FixtureCommandRunner`
- **Errores tipados** con comando, args y `stderr` truncado a 2 KB
- **Todo I/O externo entra por parámetro, nunca se instancia dentro de un wrapper.** Cuatro puertos
  inyectables: `CommandRunner` (sin default, obligatorio), `Clock` → `systemClock`, `ReadTextFile` →
  `nodeReadTextFile`, `BinaryLookup` → `nodeBinaryLookup`
- **Binarios**: `FFMPEG_PATH`, `FFPROBE_PATH`, `WHISPER_CPP_PATH`, `WHISPER_MODEL_PATH`. La variable de
  entorno gana sobre `PATH` y, si apunta a una ruta inválida, **no** cae al `PATH`
  (`BinaryNotFoundError` directo). `WHISPER_MODEL_PATH` no tiene fallback a `PATH` (un modelo no es
  ejecutable). Lookup puro de filesystem (`access`+`stat`), nunca `<binario> --version`. Alcance
  POSIX: sin `PATHEXT` ni `.exe`
- **Faster-Whisper no es un binario que la lib ejecute**: solo se interpreta su formato JSON
  (`parseFasterWhisperJson`), para comparar equivalencia con whisper.cpp. No tiene variable de entorno
- **`vite.config.ts` necesita `resolve.alias` de `@video-maker/timeline-core`** apuntando a
  `../timeline-core/src/index.ts`: `tsc` resuelve el alias por `tsconfig.base.json → paths`, pero
  Vitest/Vite no leen esa sección — sin el alias, cualquier spec que importe un valor real falla con
  `ERR_MODULE_NOT_FOUND` aunque `lint`/`build` estén verdes
- ESLint de la lib confina el I/O por directorio: `execa` solo en
  `src/runner/execa-command-runner.ts`; `node:fs`/`node:fs/promises` solo en `src/fs/**`,
  `src/__fixtures__/**` y `*.spec.ts`; `child_process` prohibido en todos lados; `Date` solo en
  `src/clock.ts`; `process`/`Math.random` prohibidos en producción
- **Sin comentarios** en el código; nombres declarativos, funciones cortas
- Tags Nx: `scope:engine`, `type:util` → `onlyDependOnLibsWithTags: ['type:domain']`. Depende solo de
  `libs/timeline-core`
- Targets: `lint`, `test` (`vitest run --coverage --passWithNoTests`, umbral 80 %, real 98.03 %
  statements / 94.77 % ramas), `build` (`tsc -p tsconfig.lib.json`); sin plugins inferidos en `nx.json`
- **`ExecaCommandRunner.run()` es la única ruta sin test por diseño** (ejecutar un proceso real está
  prohibido por RNF-3); `mapExecaResult`, que concentra la lógica de traducción, sí está cubierto al
  100 % con dobles. La verificación del wrapper real es el smoke manual del README
