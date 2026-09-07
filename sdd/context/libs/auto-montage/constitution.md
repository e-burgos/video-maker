# Constitución — libs/auto-montage

> Versión 1.0 | Última actualización: cycle-0 (inicial) | Fecha: 2026-09-07
> Creada por el orquestador al abrir `cycle-01` de `spec-e-burgos-002-auto-montage-pipeline`.
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** lib Node (TypeScript, solo servidor)
- **Rol en el sistema:** el pegamento del motor. Toma un **proyecto de medios**
  (`media/<project-slug>/`), lo ingiere (descubrimiento, probe, transcripción), extrae conceptos de
  la locución, planifica el B-roll y compone los cálculos puros de `timeline-core` en una
  `EditDecisionList` y una `Timeline` validada. No renderiza y no invoca binarios por su cuenta:
  todo binario pasa por `media-local`.

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22)
- `@video-maker/timeline-core` (contratos y cálculos puros) + `@video-maker/media-local` (probe,
  transcripción) — **sin dependencias npm nuevas salvo justificación del arquitecto**
- `zod` para validar todo lo que se lee de disco (`catalog.json`, `edl.json`, `timeline.json`)
- Vitest; cero binarios y cero filesystem real en CI

## 3. Estructura y patrones

> Árbol definitivo lo fija el arquitecto de `cycle-01`. Esquema previsto:

- `src/index.ts` única superficie pública
- `src/project/` — contrato del proyecto de medios: resolución de rutas, invariante `raw/` de solo
  lectura, serialización del catálogo
- `src/ingest/` — descubrimiento y clasificación de assets, probe, transcripción incremental
- `src/concepts/` — keyword spotting sobre `Transcription`
- `src/broll/` — planificador de superposición por concepto
- `src/presets/` — `software-demo | hardware | recipe | educational`
- `src/auto-montage.ts` — `autoMontage(project, preset)` → EDL + Timeline
- `src/__fixtures__/` — árboles de proyecto y transcripciones de fixture

## 4. Convenciones propias

- **Todo I/O entra por puertos inyectables**, igual que `media-local`: `CommandRunner` para binarios
  y un puerto de filesystem para leer/escribir. Ningún módulo instancia I/O adentro. Es lo que hace
  que la suite corra sin binarios (RNF-3 de la spec).
- **`raw/` es de solo lectura por contrato**: cualquier escritura bajo `raw/` es un error tipado, no
  una convención de buena voluntad.
- **Rutas relativas a la raíz del proyecto de medios**, nunca absolutas: es lo que mantiene el render
  en la rama `staticFile()` verificada de `assetSrc` (ver D-2 de la spec).
- **Determinismo**: sin `Date`, `process` ni `Math.random` en producción; el `seed` entra por
  parámetro. ESLint lo impone mecánicamente, como en las otras libs del repo.
- **Idempotencia**: cada etapa se puede re-ejecutar; nada depende de un archivo de `work/` que no
  sepa regenerar desde `raw/`.
- **Sin comentarios** en el código; nombres declarativos, funciones cortas.
- Tags Nx: `scope:engine` + el tag de tipo que decida el arquitecto (**D-1 de la spec**: primera lib
  que necesita depender de `type:domain` y `type:util` a la vez; las boundaries del
  `eslint.config.mjs` raíz no lo contemplan hoy).
- Targets explícitos como en `timeline-core`/`media-local`: `lint`, `test`
  (`vitest run --coverage --passWithNoTests`), `build` (`tsc -p tsconfig.lib.json`); sin plugins
  inferidos en `nx.json`.
- `vite.config.ts` **debe** declarar `resolve.alias` de `@video-maker/timeline-core` y
  `@video-maker/media-local` (lección de `cycle-02` de `spec-001`: `tsc` resuelve por
  `tsconfig.base.json → paths`, Vitest no).
