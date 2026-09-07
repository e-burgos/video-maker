# SPEC-e-burgos-006: Web Studio: Preview, Assets & Render

> Estado: **draft** — el sdd-orchestrator la pasa a `in-progress` al abrir `cycle-01`.

## Resumen Ejecutivo

Interfaz React 19 en `apps/web` para operar el motor: biblioteca de assets crudos conectada al servicio local, previsualización de la `Timeline` con `@remotion/player`, ajustes manuales sobre las decisiones de edición (mover cortes, cambiar B-roll, editar captions) y disparo/seguimiento de renders locales.

> Borrador registrado en el desglose inicial de módulos (2026-09-07). Se redacta en detalle cuando la spec anterior de la cadena cierre su último ciclo; el contrato de datos base es el de `spec-e-burgos-001-core-composition-media-pipeline`.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

**Alcance previsto:** vistas de assets, editor de timeline sobre el contrato de 001, preview con Player, panel de jobs de render, presets de formato 9:16 / 16:9.

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

- Subproyectos: `apps/web`
- `spec-e-burgos-003-kinetic-captions`
- `spec-e-burgos-005-render-service`

## Criterios de Aceptación

- CA-001: [Condición verificable para considerar implementada la spec.]
