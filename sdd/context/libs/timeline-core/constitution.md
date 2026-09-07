# Constitución — libs/timeline-core

> Versión 1.0 | Última actualización: cycle-0 (inicial) | Fecha: 2026-09-07
> Creada por el orquestador al abrir `cycle-01` de `spec-e-burgos-001-core-composition-media-pipeline`.
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** lib de dominio (TypeScript puro, isomórfica)
- **Rol en el sistema:** fuente de verdad de los contratos de datos del motor de video
  (`Timeline`, `EditDecisionList`, `Transcription`, `MediaAsset`, `AudioMixPlan`, `OutputFormat`)
  y de los cálculos de edición que los producen y validan. Ninguna otra lib define esos tipos.

## 2. Stack tecnológico

- TypeScript estricto (ESM, `module: esnext`, `target: es2022`)
- Zod 4 para schemas y tipos inferidos; JSON Schema generado con `z.toJSONSchema()`
- Vitest para tests; sin dependencias de runtime fuera de `zod`

## 3. Estructura y patrones

- `src/index.ts` es la única superficie pública
- `src/schemas/` — un archivo por contrato, exporta el schema Zod y el tipo inferido
- `src/units/`, `src/format/`, `src/silence/`, `src/punch-in/`, `src/captions/`, `src/ducking/`, `src/timeline/` — un módulo por familia de cálculos, funciones puras
- `schemas/*.schema.json` — JSON Schema generado y commiteado (test anti-drift)
- `src/__fixtures__/` — EDL y transcripciones de ejemplo para tests

## 4. Convenciones propias

- **Cero I/O y cero React**: no importar `node:*`, `fs`, `child_process` ni `react`
- **Determinismo**: nada de `Date.now()`, `Math.random()` ni lectura de `process.env`; la variación se recibe por `seed`
- **Unidades**: `Ms` (enteros) en el dominio de medios, `Frame` (enteros) en la timeline; una única función de conversión
- **Sin comentarios** en el código (regla del repo); nombres declarativos y funciones cortas
- Tags Nx: `scope:engine`, `type:domain`. No depende de ninguna otra lib del repo
- Alias de import: se decide en `cycle-01` siguiendo la convención de `tsconfig.base.json`
