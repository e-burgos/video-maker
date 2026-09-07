# Constitución — libs/media-local

> Versión 1.0 | Última actualización: cycle-0 (inicial) | Fecha: 2026-09-07
> Creada por el orquestador al abrir `cycle-02` de `spec-e-burgos-001-core-composition-media-pipeline`.
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** lib Node (TypeScript, solo servidor)
- **Rol en el sistema:** única puerta del motor hacia los binarios locales (ffprobe, ffmpeg,
  whisper-cli). Ejecuta comandos a través de un runner inyectable y convierte su salida a los
  contratos de `@video-maker/timeline-core`. Ninguna otra lib invoca binarios.

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22)
- `execa` para el runner real; `zod` para validar salidas externas
- Vitest con fixtures grabadas; cero binarios en CI

## 3. Estructura y patrones

- `src/index.ts` única superficie pública
- `src/runner/` — `CommandRunner`, `ExecaCommandRunner`, `FixtureCommandRunner`, errores tipados
- `src/binaries/` — resolución de rutas por variables de entorno y `PATH`
- `src/ffprobe/`, `src/ffmpeg/`, `src/whisper/` — un wrapper (I/O vía runner) + un parser puro por comando
- `src/__fixtures__/` — salidas reales grabadas de cada binario

## 4. Convenciones propias

- **Parser puro separado del wrapper**: el wrapper arma argumentos y ejecuta; el parser recibe texto y devuelve un contrato validado. Los tests cubren el parser con fixtures y el wrapper con `FixtureCommandRunner`
- **Errores tipados** con comando, args y `stderr` truncado a 2 KB
- **Binarios**: `FFMPEG_PATH`, `FFPROBE_PATH`, `WHISPER_CPP_PATH`, `WHISPER_MODEL_PATH`; fallback al `PATH`; nunca se descargan
- **Sin comentarios** en el código; nombres declarativos, funciones cortas
- Tags Nx: `scope:engine`, `type:util`. Depende solo de `libs/timeline-core`
- Targets explícitos como en `timeline-core`: `lint`, `test` (`vitest run --coverage --passWithNoTests`), `build` (`tsc -p tsconfig.lib.json`); sin plugins inferidos en `nx.json`
