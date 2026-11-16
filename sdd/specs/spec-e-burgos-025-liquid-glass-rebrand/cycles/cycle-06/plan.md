# spec-e-burgos-025-liquid-glass-rebrand — cycle-06 · plan (lite)

> Módulo: liquid-glass-rebrand | Subproyectos: apps/web, apps/render-api, apps/desktop | Fecha: 2026-11-13
> Objetivo: paridad del studio con la web pública: Aprender, Acerca de (versión, buscar actualizaciones, licencias e inventario, código abierto, privacidad, requisitos), Conectar agentes y búsqueda de material libre en la biblioteca.
> Fuera de alcance: cambios en `apps/docs-site` (D-11); `autoUpdater` (D-08); `apps/motion-editor`.

## Pendientes del ciclo 05
- e2e de web sin correr (escriben datos; studio compartido): se corren antes de la PR.

## Decisiones del ciclo
- Navegación: en SISTEMA quedan Configuración, Aprender (reemplaza a Guía; `/guide` redirige a `/learn`) y Acerca de (`/about`). Conectar agentes es la pestaña `agents` de ajustes.
- Contenido propio (D-09): la app guarda su copia de los textos de Aprender, privacidad, código abierto e inventario en `apps/web/src/content/` (es y en). Un spec de alineación compara los ids del inventario de la app con `apps/docs-site/src/tech-inventory.mjs` para detectar desvíos.
- Tutorial (D-10): `<video>` opaco con la URL pública de R2 (`https://video.estebanburgos.com.ar/tutoriales/Tutorial-Video-Maker.mp4`); sin conexión muestra un aviso.
- Galería: usa las capturas de `apps/docs-site/public/screenshots/` copiadas a `apps/web/public/gallery/` (solo las del studio).
- Actualizaciones (D-08): `apps/desktop/scripts/release-desktop.mjs` sube además `descargas/latest.json` (`version`, `url`, `sha256`, `publishedAt`). El render-api expone `GET /api/app/update` que lee ese manifiesto (timeout corto, sin caché persistente) y lo compara con la versión instalada; responde `up-to-date`, `available` (con URL de descarga) o `unknown`. Mientras no exista el manifiesto en R2, la respuesta es `unknown` y la UI lo dice sin error.
- Links externos: en Electron, los `target="_blank"` ya se abren en el navegador (main.ts); no hace falta IPC nuevo.
- Requisitos: se arman con `GET /api/health` (binarios, motores del productor y versión), con estado por ítem y cómo resolverlo; el modal de estado enlaza a Acerca de → Requisitos.
- Material libre: panel «Buscar material libre» en la biblioteca (acción secundaria del toolbar) sobre `GET/POST /api/projects/:slug/media/{search,import}` y `music/{search,import}`; resultados en grilla opaca con fuente, licencia y atribución; importar asigna el rol elegido.

## Historias
- US-025-601 — Como usuario quiero aprender a usar Video Maker sin salir de la app. CA: `/learn` con pestañas Guía, Cómo funciona, Tutorial, Preguntas frecuentes y Galería; contenido alineado con la web en es y en.
- US-025-602 — Como usuario quiero saber qué versión tengo y si hay una nueva. CA: `/about` con versión instalada y «Buscar actualizaciones» manual con los tres resultados; licencias e inventario de tecnología, código abierto y privacidad.
- US-025-603 — Como usuario quiero saber si mi equipo cumple los requisitos. CA: sección Requisitos con cada binario y motor, su estado y cómo resolverlo; acceso desde el modal de estado.
- US-025-604 — Como usuario quiero conectar mis agentes al studio. CA: pestaña Agentes en ajustes con Claude Code (plugin), Copilot y Gemini (MCP), configuraciones copiables y estado de los motores.
- US-025-605 — Como usuario quiero buscar B-roll y música libres desde la biblioteca. CA: panel de búsqueda con resultados, licencia y atribución, e importación con rol.

## Tasks (detalle en tasks.json)
- TASK-001 — Aprender (`/learn`), contenido propio y galería. Valida: specs y capturas.
- TASK-002 — Acerca de y requisitos: `/about`, `GET /api/app/update` en render-api, `latest.json` en el release. Valida: specs de web y render-api, capturas.
- TASK-003 — Conectar agentes (pestaña de ajustes) y material libre en la biblioteca. Valida: specs y capturas.
- TASK-004 — Verificación del ciclo y cierre de la spec: contraste en todas las rutas nuevas, revisión en Electron de desarrollo si el studio lo permite, resumen final.

## Decisiones técnicas
- `api.json` suma `GET /api/app/update`; sin cambios de `schema.json`.
- TASK-001, TASK-002 y TASK-003 en serie (comparten i18n, rutas y barra lateral).
