# spec-e-burgos-021-brand-kit — cycle-03 · plan (lite)

> Módulo: brand-kit | Subproyectos: apps/web, apps/render-api, libs/producer-tools, libs/motion-graphics, apps/desktop | Fecha: 2026-10-08
> Objetivo: un video de motion graphics se produce con cualquier marca de la biblioteca, desde la web, el productor y la app instalada.
> Fuera de alcance: material crudo (cycle-04).

## Historias
- US-021-301 — Como usuario quiero elegir cualquier marca al crear un video y en el brief. CA: el selector de marca del brief y del alta muestra incluidas y propias con su logo; un proyecto guarda su marca.
- US-021-302 — Como usuario quiero que el storyboard automático y el productor usen la marca elegida. CA: `get_motion_brands` lista las propias; la IA recibe voz, música, fotos y productos de esa marca; una marca sin música compone sin música y sin fallar.
- US-021-303 — Como usuario de la app instalada quiero crear una marca y producir con ella. CA: en la app empaquetada la marca se guarda en `brands/` junto a la carpeta de proyectos y un video motion corto se renderiza con ella.

## Tasks (detalle en tasks.json)
- TASK-001 — Marca del proyecto: columna `brand` en `projects` (local-store, migración), `POST /projects` y `PATCH /projects/:slug` la aceptan, `GET` la devuelve; el brief de un proyecto motion la toma por defecto.
- TASK-002 — Web: selector de marca con logo y colores en el alta del proyecto y en el brief; enlace a la página Marcas.
- TASK-003 — Productor: `get_motion_brands` y el contexto del proyecto traen la marca (nombre, nombre hablado, tagline, web, fuente propia o incluida); receta motion actualizada.
- TASK-004 — Robustez con marcas mínimas: sin música, sin fotos, sin productos, sin isotipo: storyboard automático y composición sin errores (tests con una marca mínima).
- TASK-005 — Verificación punta a punta con `pnpm studio` y con la app empaquetada: marca de prueba → video motion corto renderizado, snapshot revisado.

## Decisiones técnicas
- La marca del proyecto vive en SQLite (como `mode`), no en el brief: sirve igual a material crudo (cycle-04).
