# spec-e-burgos-006-web-studio — cycle-01 · plan (lite)

> Módulo: web-studio | Subproyectos: apps/web | Fecha: 2026-09-09
> Objetivo: dejar `apps/web` convertida en el shell real del studio —sin restos del generador, con
> suite propia— hablando con `apps/render-api` por un cliente HTTP tipado detrás del proxy `/api`,
> con listado y creación de proyectos y la biblioteca de assets del proyecto reproducible desde
> `EP-011`. Fuera de alcance: Remotion `<Player>` y componente de video conmutable (cycle-02),
> edición del timeline, jobs de render y descarga del MP4 (cycle-03), autenticación, despliegue.

Contexto leído una vez al abrir: `sdd/dual-harness/rules/sdd-gates.md` § Flow ·
`sdd/memory/lessons.md` completo · `sdd/api.json` (`apps/render-api` → EP-001..EP-015) ·
`sdd/context/apps/render-api/` (base + 3 fragmentos) · `apps/render-api/README.md` ·
`libs/composition-remotion/README.md` § OffthreadVideo · `sdd/context/apps/web/` ·
`sdd/schemas/{cycle,cycle-tasks,components}.schema.json`.

## Historias

- **US-1-001** — Como dev quiero que `apps/web` no arrastre nada del generador Nx para que el
  primer ciclo real no herede placeholders ni targets falsos. CA: no existen `Dockerfile` ni
  `nginx.conf`, `web:lint` dice `All files pass linting`, y `web:test` corre una suite real en
  `jsdom` con cobertura sobre un piso declarado (CA-001, CA-002, CA-003).
- **US-1-002** — Como dev quiero un cliente HTTP tipado del servicio para no repartir `fetch`
  sueltos ni URLs absolutas por los componentes. CA: un test por endpoint de RF-3 verifica método,
  path, cabeceras y parseo; un test por forma de error de RF-4; nadie fuera de `src/api/` conoce
  host, puerto ni el prefijo `/api` (CA-005, CA-006, CA-007).
- **US-1-003** — Como dev quiero ver siempre si el servicio está vivo y qué capacidades reporta
  para saber si lo que veo en pantalla es un problema de la UI o del backend. CA: el badge de
  salud distingue `ok`, `degraded` e inalcanzable, y en `degraded` dice qué módulo o binario falta
  (RF-5).
- **US-1-004** — Como dev quiero listar los proyectos del store y crear uno nuevo por slug sin
  salir del navegador. CA: el listado muestra los cinco flags de layout de `EP-002`, y el formulario
  rechaza en el cliente el slug que el servicio rechazaría con `PROJECT_SLUG_INVALID` antes de
  emitir el request (RF-6, CA-007).
- **US-1-005** — Como dev quiero ver los assets crudos de un proyecto agrupados por rol, con su
  origen y sus datos de media, y poder verlos o escucharlos ahí mismo. CA: los cuatro roles, el
  `source` (`catalog` | `raw-scan`), las `probeFailures`, y `<video>`/`<audio>`/`<img>` con el `src`
  bajo `/api/projects/<slug>/files/` (RF-7, RF-8, CA-008).
- **US-1-006** — Como dev quiero subir un asset a un rol desde la biblioteca y que el listado se
  actualice, o que me diga con qué código falló. CA: `PUT` binario con `content-type`, refresco del
  listado en el éxito, y en el error el `code` en pantalla **sin** refrescar el listado (RF-9,
  CA-009).
- **US-1-007** — Como dev quiero evidencia de que la pantalla se dibuja de verdad contra el
  servicio real, no sólo tests verdes. CA: capturas de Playwright de la lista de proyectos y de la
  biblioteca de `smoke-ingest`, con el health en `ok`, guardadas en `artifacts/` (RF-10, CA-010,
  CA-011).

## Tasks (detalle en tasks.json)

- **TASK-001** — Auditoría del scaffold: borrar `Dockerfile` y `nginx.conf` (D-11) y la página
  placeholder; reemplazar el `!` de `main.tsx:6` por un guard explícito (warning preexistente de
  `no-non-null-assertion`); título real en `index.html`; en `apps/web/vite.config.ts` sumar el
  bloque `test` (jsdom, `include`, `setupFiles`, `coverage` con piso 80 %) y el proxy
  `/api` → `RENDER_API_URL` (D-4). Lo valida: `nx run-many -t lint test build` verde y sin warnings.
- **TASK-002** — `src/api/`: tipos del contrato declarados desde `sdd/api.json` (D-5)
  (`ServiceHealth`, `ProjectSummary`, `ProjectDetail`, `AssetListing`, `AssetListEntry`,
  `RenderApiErrorPayload`); `RenderApiError` con el `code` del servicio y los tres códigos propios
  de transporte; `projectSlugProblem()` espejo de `PROJECT_SLUG_INVALID`; `artifactUrl()` con
  percent-encode por segmento; `createRenderApiClient()` con `fetch` inyectable cubriendo EP-001,
  EP-002, EP-003, EP-004, EP-005, EP-006. Lo validan: `render-api-client.spec.ts` (un caso por
  endpoint + los tres de error), `artifact-url.spec.ts`, `project-slug.spec.ts`,
  `render-api-error.spec.ts`.
- **TASK-003** — Shell: `RenderApiProvider`/`useRenderApi` (inyección del cliente para los tests);
  `useAsyncResource` (`idle|loading|ready|error` + `reload`, con guard de respuesta obsoleta);
  `StudioLayout` con `ServiceHealthBadge` y navegación; `ErrorNotice` (render único de un
  `RenderApiError`); rutas `/` y `/projects/:slug`; tokens de color en `index.css`. Lo validan:
  `use-async-resource.spec.ts` y `service-health-badge.spec.tsx`.
- **TASK-004** — `ProjectsPage`: listado de `EP-002` con los flags de layout y link a la biblioteca;
  `CreateProjectForm` con validación de slug en cliente y `EP-003`, que refresca el listado al
  crear. Lo validan: `projects-page.spec.tsx` y `create-project-form.spec.tsx`.
- **TASK-005** — `AssetLibraryPage`: `EP-004` + `EP-005`, agrupación por los cuatro roles, `source`
  y `probeFailures`; `AssetCard` con los datos de media del catálogo; `AssetPreview` que elige
  `<video>`/`<audio>`/`<img>` por extensión (`assetMediaKind`) con `src` de `artifactUrl`;
  `AssetUploader` con `PUT` de `EP-006`, estado de progreso y error tipado. Lo validan:
  `asset-library-page.spec.tsx`, `asset-card.spec.tsx`, `asset-uploader.spec.tsx`,
  `asset-media-kind.spec.ts`.
- **TASK-006** — Verificación visual real (D-10): `render-api` corriendo contra `media/` con el
  binario (`SWC_NODE_PROJECT=tsconfig.base.json`, patrón `server-register.cjs`, puerto libre) +
  `vite preview` de la app; Playwright navega y captura la lista de proyectos y la biblioteca de
  `smoke-ingest`; `artifacts/visual-verification.md` con el guion literal; `apps/web/README.md`;
  alta de los componentes en `sdd/components.json`.

## Decisiones técnicas (obligatoria si toca schema/api/components)

- **Stack de UI: React 19 + `react-router-dom` 7 + Tailwind CSS 4, todo ya en el manifiesto raíz →
  cero dependencias npm nuevas** (spec D-2, RNF-1). No entra ninguna librería de componentes: la
  superficie de este ciclo son listas, un formulario y tarjetas de media; un design system pesaría
  más que la app. Registro afectado: ninguno (`package.json` no se toca).
- **Estado: `useAsyncResource` propio, sin TanStack Query ni store global** (spec D-3). El hook
  expone `idle|loading|ready|error` y `reload()`, y descarta la respuesta de un request obsoleto con
  un contador de secuencia. Se revisa en `cycle-03` con el polling de jobs como consumidor real.
- **Transporte: el cliente resuelve todo contra rutas relativas `/api/...`; el dev-server de Vite
  proxea a `RENDER_API_URL` quitando el prefijo** (spec D-4, evidencia: `render-api` no emite
  cabeceras CORS). Consecuencia buscada: las URLs de `EP-011` quedan same-origin para el `<Player>`
  de `cycle-02` y para cualquier `<video>` con `Range`. Ningún componente conoce host ni puerto
  (RNF-4).
- **Tipos del contrato declarados en `apps/web/src/api/render-api-types.ts` desde `sdd/api.json`,
  no importados de `apps/render-api` ni de `libs/auto-montage`** (spec D-5): la primera es otra app
  y la segunda es una lib Node que no puede entrar a un bundle de navegador. Registro afectado:
  `sdd/api.json` **no cambia** — este ciclo no crea ni modifica ningún endpoint, sólo consume
  EP-001..EP-006 y EP-011, que ya están `implemented`.
- **Superficie de errores: `RenderApiError` conserva el `code` del servicio**, y agrega exactamente
  tres códigos propios de transporte para lo que el servicio no puede nombrar:
  `SERVICE_UNREACHABLE` (el `fetch` rechaza), `RESPONSE_NOT_JSON` (status de error sin payload
  parseable) y `RESPONSE_SHAPE_UNEXPECTED` (200 con un cuerpo que no tiene la forma del contrato).
  La UI muestra `code` + `message`, nunca la excepción cruda (spec D-7, RF-4).
- **`assetMediaKind` decide `<video>`/`<audio>`/`<img>` por extensión con una tabla cerrada propia**,
  espejo de la tabla de content-type de `render-api` (`http/content-type-for.ts`), no por el
  `content-type` de una request previa: la decisión se toma al pintar la lista, sin un round-trip
  por asset. Una extensión desconocida cae en un link de descarga, nunca en un `<video>` roto.
- **`sdd/components.json` gana la app-key `apps/web`** con los componentes del ciclo (`COMP-001`
  correlativo propio de la app, según el `_schema` del registro), cada uno con su `consumes` de
  endpoints. Registro afectado: `sdd/components.json`.
- **`sdd/schema.json` no se toca**: este ciclo no crea ninguna tabla (no hay base de datos en el
  producto).
