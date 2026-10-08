# spec-e-burgos-021-brand-kit — cycle-02 · plan (lite)

> Módulo: brand-kit | Subproyectos: apps/web, apps/render-api, libs/motion-graphics | Fecha: 2026-10-08
> Objetivo: página Marcas con creador por secciones y vista previa en vivo, sobre la API del cycle-01.
> Fuera de alcance: usar la marca en material crudo (cycle-04).

## Historias
- US-021-201 — Como usuario quiero ver mis marcas y las incluidas, y crear una de cero o duplicando DisplayAds. CA: `/brands` lista con logo y colores; "Nueva marca" y "Duplicar" llevan al editor.
- US-021-202 — Como usuario quiero editar identidad, logo, colores, tipografías, voz, música, fotos y productos. CA: cada sección guarda con `PUT /brands/:id`, los archivos suben con `PUT /brands/:id/files`, y una incluida se muestra de sólo lectura con "Duplicar".
- US-021-203 — Como usuario quiero ver la marca aplicada mientras la edito. CA: la vista previa muestra la apertura (`brand-reveal`) y el cierre (`cta`) con la marca; un cambio de color se ve sin recomponer y un cambio de logo o tipografía recompone.
- US-021-204 — Como usuario quiero elegir tipografías de Google Fonts sin internet al renderizar. CA: elegir una familia la descarga a la marca (woff2 latin + latin-ext) y queda en `fonts[]` y `typography`.

## Tasks (detalle en tasks.json)
- TASK-001 — Vista previa en el servidor: `POST /brands/:id/preview` compone un storyboard mínimo (`brand-reveal` + `cta`, sin voz ni música, duración fija) en `<brandsRoot>/.preview/<id>/` y lo sirve en `GET /brands/:id/preview/*`; el HTML escucha `postMessage` para reemplazar variables `--mg-*` y reproducir en bucle.
- TASK-002 — `POST /brands/:id/fonts {family}`: baja de Google Fonts los woff2, los guarda en `fonts/`, actualiza `fonts[]`; lista curada de familias en la web.
- TASK-003 — Página `/brands` (lista, nueva, duplicar, borrar) y acceso "Marcas" en el encabezado del estudio.
- TASK-004 — Editor `/brands/:id` por secciones: identidad, logo (logo e isotipo), colores (4 base + avanzado con todas las variables), tipografías, voz (selector con prueba de voz y velocidad), música (subir, crédito, BPM, ánimo, drop), fotos (subir + descripción), productos (foto, tipo, nombre hablado, 4 esquinas de la pantalla marcadas sobre la foto).
- TASK-005 — Verificación con `pnpm studio`: crear una marca de prueba, cambiar colores con la vista previa en vivo, subir logo y fuente, duplicar DisplayAds; capturas como evidencia.

## Decisiones técnicas
- La vista previa reutiliza `composeStoryboard` con un timeline sintético: misma composición que el render, sin audio.
- Colores en vivo por `postMessage` (sin recomponer); logo, tipografías y textos recomponen.
- Endpoints nuevos en render-api: `/brands/:id/preview`, `/brands/:id/fonts`.
