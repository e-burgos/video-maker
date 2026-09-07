# SPEC-e-burgos-004: Multi-Track Audio Mix & Mastering

> Estado: **draft** — el sdd-orchestrator la pasa a `in-progress` al abrir `cycle-01`.

## Resumen Ejecutivo

Mezcla y mastering multi-pista final: normalización de la locución a -14 LUFS / -1 dBTP, aplicación de la automatización de ducking del `AudioMixPlan` sobre la música (-24 dB bajo la voz), generación de filtergraphs FFmpeg (`sidechaincompress` o volumen automatizado por keyframes), fades y mux final del MP4 renderizado por Remotion con la pista de audio masterizada.

> Borrador registrado en el desglose inicial de módulos (2026-09-07). Se redacta en detalle cuando la spec anterior de la cadena cierre su último ciclo; el contrato de datos base es el de `spec-e-burgos-001-core-composition-media-pipeline`.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

**Alcance previsto:** filtergraph builder tipado y testeable sin ffmpeg, medición post-mix (loudness de verificación), integración con `renderTimeline` para producir el entregable final.

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

- Subproyectos: `libs/media-local`, `libs/composition-remotion`
- `spec-e-burgos-001-core-composition-media-pipeline`

## Criterios de Aceptación

- CA-001: [Condición verificable para considerar implementada la spec.]
