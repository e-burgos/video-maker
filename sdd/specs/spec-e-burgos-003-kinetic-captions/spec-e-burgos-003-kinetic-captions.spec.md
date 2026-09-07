# SPEC-e-burgos-003: Kinetic Captions & Safe Zones

> Estado: **draft** — el sdd-orchestrator la pasa a `in-progress` al abrir `cycle-01`.

## Resumen Ejecutivo

Componente de kinetic typography para Remotion: 1 a 3 palabras por pantalla con resaltado de la palabra de impacto, animaciones de entrada/salida con `spring`, presets tipográficos y de color, y posicionamiento dentro de las safe zones de Instagram/TikTok/YouTube definidas en el contrato `Timeline.safeZone`.

> Borrador registrado en el desglose inicial de módulos (2026-09-07). Se redacta en detalle cuando la spec anterior de la cadena cierre su último ciclo; el contrato de datos base es el de `spec-e-burgos-001-core-composition-media-pipeline`.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

**Alcance previsto:** `<KineticCaptions />` sobre `tracks.captions`, estilos de énfasis (escala, color, fondo), presets por caso de uso, fuentes locales empaquetadas, previsualización en `remotion studio`.

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

- Subproyectos: `libs/composition-remotion`
- `spec-e-burgos-001-core-composition-media-pipeline`

## Criterios de Aceptación

- CA-001: [Condición verificable para considerar implementada la spec.]
