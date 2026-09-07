# SPEC-e-burgos-005: Local Render Service & Asset Storage

> Estado: **draft** — el sdd-orchestrator la pasa a `in-progress` al abrir `cycle-01`.

## Resumen Ejecutivo

Servicio local Node (`apps/render-api`) que expone una API REST para gestionar assets crudos en MinIO (docker-compose del repo), encolar jobs de render headless (Remotion + FFmpeg) con progreso y cancelación, y persistir timelines/EDL generadas. Corre en la máquina del dev; no tiene autenticación multiusuario ni despliegue cloud en su alcance inicial.

> Borrador registrado en el desglose inicial de módulos (2026-09-07). Se redacta en detalle cuando la spec anterior de la cadena cierre su último ciclo; el contrato de datos base es el de `spec-e-burgos-001-core-composition-media-pipeline`.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

**Alcance previsto:** endpoints de assets (upload/list/probe), jobs de render (create/status/cancel), storage de `Timeline`/`EditDecisionList` como JSON, cola en proceso con concurrencia 1.

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

- Subproyectos: `apps/render-api`
- `spec-e-burgos-001-core-composition-media-pipeline`
- `spec-e-burgos-002-auto-montage-pipeline`

## Criterios de Aceptación

- CA-001: [Condición verificable para considerar implementada la spec.]
