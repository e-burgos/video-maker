# SPEC-e-burgos-002: Auto-Montage A-Roll / B-Roll Pipeline

> Estado: **draft** — el sdd-orchestrator la pasa a `in-progress` al abrir `cycle-01`.

## Resumen Ejecutivo

Pipeline de montaje automático A-roll / B-roll: ingesta de una carpeta de clips crudos (probe + transcripción), poda de silencios sobre material real, extracción de conceptos clave de la locución y superposición de B-roll e imágenes por concepto, selección de transiciones (whip pan, slide, light leaks) según preset de caso de uso y una CLI headless (`tools/render-cli`) que va de carpeta de assets a MP4.

> Borrador registrado en el desglose inicial de módulos (2026-09-07). Se redacta en detalle cuando la spec anterior de la cadena cierre su último ciclo; el contrato de datos base es el de `spec-e-burgos-001-core-composition-media-pipeline`.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

**Alcance previsto:** ingesta y catálogo local de assets, keyword spotting sobre `Transcription`, planificador de B-roll, presets `software-demo | hardware | recipe | educational`, CLI `ingest → edl → timeline → render`.

## Evidencia y decisiones

> Citar, no copiar: las filas de `harness.idea.md` → **Evidencia del descubrimiento** y
> **Decisiones del dev** que fundamentan esta spec (por fuente y fecha).

- [Evidencia: fuente → dato medido (fecha)]
- [Decisión del dev que acota el alcance (fecha)]

## Requisitos Funcionales (RF)

- RF-1: [Descripción]
- RF-2: [Descripción]

## Requisitos No-Funcionales (RNF)

- RNF-1: [Performance, seguridad, cobertura mínima, etc.]

## Dependencias

- Subproyectos: `libs/auto-montage`, `tools/render-cli`
- `spec-e-burgos-001-core-composition-media-pipeline`

## Criterios de Aceptación

- CA-001: [Condición verificable para considerar implementada la spec.]
