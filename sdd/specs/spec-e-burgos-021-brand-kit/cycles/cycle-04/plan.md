# spec-e-burgos-021-brand-kit — cycle-04 · plan (lite)

> Módulo: brand-kit | Subproyectos: libs/timeline-core, libs/composition-remotion, libs/auto-montage, apps/render-api, apps/web, libs/producer-tools | Fecha: 2026-10-08
> Objetivo: un video de material crudo con marca toma de ella logo, placas, subtítulos, voz y contexto del productor.
> Fuera de alcance: borrador de marca por IA.

## Historias
- US-021-401 — Como usuario quiero que el logo de la marca se use como marca de agua y en las placas sin subirlo al proyecto. CA: al elegir marca el logo aparece como asset `logo` del proyecto y el montaje lo usa; la placa usa el fondo de la paleta.
- US-021-402 — Como usuario quiero subtítulos con los colores y la tipografía de la marca. CA: estilo de subtítulos `brand` disponible en el selector; el render usa la fuente de la marca (offline) y sus colores.
- US-021-403 — Como usuario quiero que la locución use la voz de la marca. CA: un job de voz sin `voiceId` usa la voz y velocidad de la marca del proyecto.
- US-021-404 — Como usuario quiero que el productor conozca la marca. CA: el contexto del productor trae nombre, tagline y web, y el cierre del guion los usa.

## Tasks (detalle en tasks.json)
- TASK-001 — Aplicar marca a un proyecto de material crudo: copia el logo de la marca a `raw/logo/` (PNG; un SVG se rasteriza) y lo registra en el catálogo; cambio de marca reemplaza ese logo.
- TASK-002 — Timeline: `captionTheme` opcional (familia, archivos de fuente, color de texto, acento, caja) persistido en el documento; estilo `brand` en `CAPTION_STYLES`; preset de Remotion que carga la fuente de la marca y usa sus colores; placas con el fondo de la paleta por defecto.
- TASK-003 — Voz por defecto de la marca en el job de voz y en la página Voz.
- TASK-004 — Contexto del productor con la marca y receta de material crudo actualizada.
- TASK-005 — Verificación con `pnpm studio`: proyecto de material crudo con marca de prueba, montaje, subtítulos `brand` y render corto revisado cuadro a cuadro.

## Decisiones técnicas
- El estilo de subtítulos de la marca se persiste en el timeline (`captionStyle: 'brand'` + `captionTheme`), no como flag del render: el render lee el documento.
- Ensanchar `CAPTION_STYLES` es un cambio global: build de todos los consumidores en la misma task.
