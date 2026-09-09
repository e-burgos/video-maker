# SPEC-e-burgos-006: Web Studio: Preview, Assets & Render

> Estado: **in-progress** — detallada por el actor `lite` al abrir `cycle-01` (2026-09-09).
> Los ciclos `02` y `03` amplían sus secciones al abrirse; el cierre de la spec es del `cycle-03`.

## Resumen Ejecutivo

Interfaz React 19 en `apps/web` para operar el motor desde el navegador, en la máquina del dev:
biblioteca de assets crudos del proyecto, previsualización de la `Timeline` con el `<Player>` de
Remotion, ajuste manual de las decisiones de edición y disparo/seguimiento de renders locales con
descarga del MP4.

**`apps/web` no tiene lógica de motor ni toca el filesystem.** Todo lo que muestra y todo lo que
escribe pasa por los 15 endpoints de `apps/render-api` (`sdd/api.json` → `EP-001`..`EP-015`), que
es su único backend. La UI es un cliente HTTP con estado de pantalla: si un cálculo hace falta,
vive en una lib o en la API, nunca acá.

## Contexto de Negocio

Ver contexto de negocio y casos de uso en `spec-e-burgos-001-core-composition-media-pipeline`.

**Alcance previsto:** vistas de assets, editor de timeline sobre el contrato de 001, preview con
Player, panel de jobs de render, presets de formato 9:16 / 16:9.

## Evidencia y decisiones

> Citar, no copiar: las entradas referencian el documento origen, no lo reproducen.

- **Evidencia (`sdd/api.json`, `apps/render-api`):** los 15 endpoints ya implementados y su
  contrato de respuesta campo a campo. Es el contrato que esta spec consume; ningún endpoint
  nuevo hace falta para el alcance previsto.
- **Evidencia (`sdd/context/apps/render-api/updates/…cycle-03.md` § Qué sigue):** *"Próximo
  consumidor: `apps/web` (`spec-e-burgos-006-web-studio`), que consume HTTP y no exit codes."*
  El exit code del servicio no es contrato para esta spec.
- **Evidencia (`sdd/context/apps/render-api/updates/…cycle-02.md` § Estructura, `EP-011`):** la
  descarga de artefactos se sirve desde el propio proceso con `Range` de un solo rango
  (`spec-005` D-17), *"porque el consumidor previsto de `spec-006` es exactamente un `<video>` y
  el Remotion Player"*. Esta spec es ese consumidor.
- **Evidencia (`libs/composition-remotion/README.md` § "`OffthreadVideo` vs `Video` (nota para
  `spec-006`)"):** `OffthreadVideo` **no es equivalente** dentro de un `<Player>` en el navegador;
  hace falta un componente de video conmutable (`<Video>` en Player, `<OffthreadVideo>` en render).
  Riesgo asumido por esta spec, resuelto en `cycle-02`.
- **Evidencia (medida al abrir `cycle-01`, 2026-09-09):** `grep -rn 'access-control' apps/render-api/src/`
  no devuelve nada — el servicio **no emite ninguna cabecera CORS**. Un `fetch` desde
  `http://localhost:4200` a `http://127.0.0.1:4310` es cross-origin y el navegador lo bloquea.
  Fundamenta D-4.
- **Evidencia (medida al abrir `cycle-01`, 2026-09-09):** el manifiesto raíz ya trae
  `react-router-dom@7`, `tailwindcss@4` + `@tailwindcss/vite`, `@testing-library/react`,
  `@testing-library/dom`, `jsdom` y `@vitest/coverage-v8`. Fundamenta D-2.
- **Decisión del dev (perfil `solo`, `sdd/global.json → profile`):** las decisiones de producto de
  esta spec (stack de UI, estado, routing, estilos) las toma el actor del ciclo con recomendación
  fundada y quedan escritas en el `plan.md` del ciclo que las toma.

## Decisiones del orquestador

| ID | Decisión | Fundamento |
| --- | --- | --- |
| **D-1** | La spec se ejecuta en **tres ciclos** `lite` (ver "Plan de ciclos"), uno por hito verificable. | El alcance mezcla tres ejes con riesgos distintos: cliente HTTP + biblioteca de assets (bajo), montar la composición Remotion en un `<Player>` del navegador (alto, ver D-8), y edición del timeline + jobs (medio). Partirlo por eje deja cada sesión chica y reanudable, y no arrastra el riesgo del Player a la fundación. |
| **D-2** | **Cero dependencias npm nuevas en `cycle-01`.** La única dependencia npm nueva prevista en toda la spec es `@remotion/player`, y entra en `cycle-02`, que es donde tiene consumidor. | Todo lo que `cycle-01` necesita ya está en el manifiesto raíz (evidencia arriba). Sumar una dependencia un ciclo antes de su consumidor es peso de bundle y superficie de mantenimiento sin contraparte, y el repo ya lleva cinco specs con la regla de "cero deps nuevas salvo que un consumidor real lo exija". |
| **D-3** | **Sin librería de data-fetching ni store global** (nada de TanStack Query, Zustand, Redux). El estado de servidor entra por un hook propio `useAsyncResource` (estado `idle/loading/ready/error` + `reload()`), y el estado de pantalla por `useState`/`useReducer` locales. | La app es mono-usuario, local, y en `cycle-01` maneja tres recursos (`/health`, `/projects`, `/projects/:slug/assets`). Una caché de queries agrega una segunda fuente de verdad y ~40 kB para resolver un problema —invalidación cruzada entre muchas vistas concurrentes— que esta app no tiene. Se revisa en `cycle-03`, cuando el polling de jobs sea un consumidor real; si el hook propio no alcanza ahí, la decisión se revierte en ese ciclo y queda escrita. |
| **D-4** | **`apps/web` nunca habla con `render-api` cross-origin.** El dev-server de Vite proxea `/api/*` → `RENDER_API_URL` (default `http://127.0.0.1:4310`) quitando el prefijo, y el cliente usa siempre rutas relativas `/api/...`. | `render-api` no emite ninguna cabecera CORS (evidencia arriba) y `localhost:4200` ≠ `127.0.0.1:4310`: sin proxy, el primer `fetch` de la app falla en el navegador. Agregar CORS al servicio sería tocar otra spec ya cerrada para resolver un problema que el propio dev-server resuelve en tres líneas. **Consecuencia buscada:** las URLs de `EP-011` quedan same-origin, que es exactamente lo que el `<Player>` de `cycle-02` y cualquier `<video>` con `Range` necesitan. |
| **D-5** | **Los tipos del contrato HTTP se declaran en `apps/web`, derivados de `sdd/api.json`**; no se importan de `apps/render-api` ni de `libs/auto-montage`. | `apps/web` no puede importar otra app (no hay alias ni sería sano), y `auto-montage` es una lib Node (`node:fs`, `execa`) que no debe entrar jamás a un bundle de navegador. La frontera entre las dos apps **es** el contrato HTTP, y su registro es `sdd/api.json`: declarar los tipos ahí es reflejar la frontera, no duplicar código. |
| **D-6** | **`media/` nunca se copia a `apps/web/public`.** Todo asset se lee por `EP-011` (`GET /projects/:slug/files/*path`). | Regla heredada de `spec-005` D-3/D-17: `media/<slug>/` es la única copia del material del dev. Copiar gigabytes al `public/` de una app de Vite rompe la trazabilidad y el hot-reload. |
| **D-7** | **La copy de la UI es íntegramente en inglés**, igual que los identificadores, los payloads y el README. Los documentos SDD siguen en español. | Precedente medido del repo: la salida bilingüe de `tools/render-cli` fue un defecto que costó un fix propio (`FIX-e-burgos-002-002`). Los `code` de error que la UI muestra son los 37 códigos en inglés de `render-api`: una copy en español obliga a mantener una tabla de traducción de un contrato de máquina. |
| **D-8** | **El componente de video conmutable es alcance de `cycle-02`**, no de `cycle-01`, y vive en `libs/composition-remotion` (no en `apps/web`). | Lo pide el README de la lib como nota explícita para esta spec. Vive en la lib porque el que tiene que conmutar es el árbol de la composición, que es de la lib; ponerlo en `apps/web` obligaría a duplicar `ArollSeries`/`BrollTrack`. **Es el único punto de la spec que toca un subproyecto ajeno y que puede exigir abrir `cycle-02` como `[FULL]`**: si el cambio altera el contrato que `apps/render-api` y `tools/render-cli` consumen, deja de ser `lite`. |
| **D-9** | **`apps/web/eslint.config.mjs` no se crea.** El proyecto lintea contra el flat config raíz y sus boundaries se cumplen por el fallback `type:app` → `*`. | Mismo tratamiento que `tools/render-cli` y `apps/render-api` (`spec-005` D-9): el hook `config-protection` del harness del dev bloquea `Write|Edit` sobre ese basename y rodearlo con `Bash` anularía el guardrail. |
| **D-10** | **Cada ciclo cierra con al menos una captura real de Playwright** de la UI corriendo contra un `render-api` real, guardada en `cycles/cycle-XX/artifacts/`. Un ciclo sin captura no cierra. | Lección vigente del repo: *"Un CA aceptado como procedimiento documentado, nunca ejecutado, no está verificado"*. En una UI, `lint`/`test`/`build` verdes no prueban que la pantalla se dibuje: el smoke de `composition-remotion` estuvo roto dos specs con la suite en verde. |
| **D-11** | **Los artefactos de despliegue del generador se eliminan** (`apps/web/Dockerfile`, `apps/web/nginx.conf`). | El producto es explícitamente local y mono-usuario (`sdd/context/constitution.md`): nada sirve esta app desde un contenedor, y `render-api` sólo escucha en loopback. Son placeholders del generador Nx, no código del producto. Reversible en un paso. |

## Plan de ciclos

| Ciclo | Fase | Qué entrega | Estado |
| --- | --- | --- | --- |
| **cycle-01** | `studio-shell-and-asset-library` | `apps/web` sin placeholders del generador y con suite propia; proxy `/api` al servicio (D-4); cliente HTTP tipado de `EP-001`..`EP-006` y `EP-011` con superficie de errores por `code`; shell del studio con indicador de salud, listado y creación de proyectos, y biblioteca de assets por rol con reproducción/vista de cada asset por `EP-011` y upload binario con feedback tipado. Sin Player, sin edición de timeline, sin jobs. | **completed** |
| **cycle-02** | `timeline-preview-player` | Componente de video conmutable en `libs/composition-remotion` (D-8); `@remotion/player` (única dep npm nueva de la spec); vista de preview que lee la `Timeline` del proyecto por `EP-007` y la monta en el `<Player>` resolviendo los assets por URL de `EP-011`; controles de transporte y selección de formato 9:16 / 16:9. **La salida del render no cambia**: el smoke y los tests de la lib lo protegen. | pendiente |
| **cycle-03** | `timeline-editing-and-render-jobs` | Ajuste del timeline sobre el documento persistido (`EP-007`/`EP-008`, y `EP-009`/`EP-010` para el EDL); disparo de renders (`EP-012`), seguimiento de progreso y cancelación (`EP-013`..`EP-015`) y descarga del MP4 por `EP-011`; smoke E2E con Playwright de punta a punta (assets → timeline → render → MP4); cierre de la spec. | pendiente |

## Requisitos Funcionales (RF)

### Ciclo 01 — `studio-shell-and-asset-library`

- **RF-1:** `apps/web` queda sin ningún resto del generador: sin `Dockerfile` ni `nginx.conf`
  (D-11), sin página placeholder, con el título real de la app, sin warnings de lint y con un
  bloque `test` propio (jsdom + `@testing-library/react` + cobertura con piso) en su
  `vite.config.ts`.
- **RF-2:** El dev-server proxea `/api/*` al servicio (D-4) tomando la URL de `RENDER_API_URL`, y
  el cliente de la app resuelve todas sus URLs contra `/api` sin conocer host ni puerto.
- **RF-3:** Existe un cliente HTTP tipado de `render-api` que cubre `EP-001` (health), `EP-002`
  (listar proyectos), `EP-003` (crear proyecto), `EP-004` (detalle), `EP-005` (listar assets),
  `EP-006` (subir asset) y `EP-011` (URL de un artefacto), con los tipos de respuesta declarados
  según `sdd/api.json` (D-5).
- **RF-4:** Toda respuesta de error del servicio se traduce a un error tipado propio que conserva
  el `code` del servicio; la UI muestra el `code` y el `message` del payload, nunca una excepción
  cruda ni el texto de `fetch`. Una respuesta que no es JSON, o un servicio caído, también caen en
  esa superficie con un `code` propio.
- **RF-5:** El shell del studio muestra permanentemente el estado del servicio (`EP-001`):
  `ok` / `degraded` / inalcanzable, con las capacidades y los binarios que el health reporta.
- **RF-6:** La vista de proyectos lista los proyectos del store (`EP-002`) con sus flags de layout,
  y permite crear uno nuevo por slug (`EP-003`), rechazando en el cliente lo que el servicio
  rechazaría (slug kebab-case de un solo segmento) antes de emitir el request.
- **RF-7:** La biblioteca de assets de un proyecto lista los assets (`EP-005`) agrupados por rol
  (`aroll`, `broll`, `image`, `audio`), mostrando el origen del listado (`catalog` | `raw-scan`),
  la duración/dimensiones cuando el catálogo las trae, y las fallas de probe que el catálogo
  registre.
- **RF-8:** Cada asset se puede ver o escuchar en la propia página, servido por `EP-011` (D-6):
  video en un `<video controls>`, audio en un `<audio controls>`, imagen en un `<img>`.
- **RF-9:** Se puede subir un asset a un rol (`EP-006`) desde la biblioteca: body binario crudo
  con `content-type` y `content-length`, feedback de éxito con la entrada de catálogo devuelta, y
  feedback tipado del error cuando el servicio lo rechaza. El listado se refresca sin recargar la
  página.
- **RF-10:** Los componentes creados quedan registrados en `sdd/components.json` bajo la app-key
  `apps/web`, con el `consumes` de los endpoints que cada uno usa.

## Requisitos No-Funcionales (RNF)

- **RNF-1:** Cero dependencias npm nuevas en `cycle-01` (D-2). `git diff --stat package.json
  pnpm-lock.yaml` vacío al cerrar el ciclo.
- **RNF-2:** `pnpm nx run-many -t lint test build` en verde **y sin warnings** para todo el
  workspace, incluido el `no-non-null-assertion` preexistente de `apps/web/src/main.tsx:6`.
- **RNF-3:** Cobertura de `apps/web` con piso declarado en su `vite.config.ts` y medido sobre los
  archivos propios del ciclo; el `coverage.include` no se recorta para alcanzar el piso.
- **RNF-4:** La app no toca el filesystem ni ejecuta binarios: todo I/O es `fetch` contra `/api`.
  Ningún componente conoce el host ni el puerto del servicio.
- **RNF-5:** Cada ciclo deja al menos una captura real de Playwright de la UI contra un
  `render-api` real en `cycles/cycle-XX/artifacts/` (D-10).
- **RNF-6:** Sin comentarios en el código de implementación (regla del repo); copy, identificadores
  y README en inglés (D-7).

## Dependencias

- Subproyectos: `apps/web` (`cycle-01`, `cycle-03`), `libs/composition-remotion` (`cycle-02`, D-8)
- `spec-e-burgos-003-kinetic-captions` — completed
- `spec-e-burgos-005-render-service` — completed (backend HTTP: `EP-001`..`EP-015`)

## Criterios de Aceptación

### Ciclo 01

- **CA-001:** `apps/web/Dockerfile` y `apps/web/nginx.conf` no existen; `git ls-files apps/web` no
  devuelve ningún archivo del generador sin uso.
- **CA-002:** `pnpm nx run-many -t lint test build` termina en verde y la salida de `web:lint` dice
  `All files pass linting` (cero warnings).
- **CA-003:** `pnpm nx run web:test` corre una suite real (no `passWithNoTests`) con entorno
  `jsdom` y reporta cobertura por encima del piso declarado.
- **CA-004:** `git diff --stat package.json pnpm-lock.yaml` está vacío al cerrar el ciclo (RNF-1).
- **CA-005:** El cliente HTTP tiene un test por cada endpoint de RF-3 que verifica método, path,
  cabeceras y el parseo de la respuesta contra un `fetch` doble, y un test por cada forma de error
  de RF-4 (payload tipado del servicio, respuesta no-JSON, red caída).
- **CA-006:** Un test verifica que la URL de un artefacto (`EP-011`) sale percent-encodeada por
  segmento y siempre bajo `/api/projects/<slug>/files/`, para un path con espacios y subdirectorios.
- **CA-007:** Un test verifica que el validador de slug del cliente rechaza exactamente lo que
  `render-api` rechaza con `PROJECT_SLUG_INVALID` (no un solo segmento kebab-case) y acepta lo que
  acepta.
- **CA-008:** Un test de componente verifica que la biblioteca de assets agrupa por los cuatro
  roles, muestra el `source` del listado y renderiza `<video>`, `<audio>` o `<img>` según la
  extensión del asset, con el `src` apuntando a `/api/projects/<slug>/files/...`.
- **CA-009:** Un test de componente verifica que un error tipado del servicio (por ejemplo
  `ASSET_ALREADY_EXISTS`) se muestra en pantalla con su `code`, y que el listado **no** se refresca
  en ese caso.
- **CA-010:** **Verificación visual real:** con `apps/render-api` corriendo contra `media/` y la app
  servida por Vite, Playwright navega a la lista de proyectos y a la biblioteca de assets de
  `smoke-ingest`, y las capturas quedan en `cycles/cycle-01/artifacts/`. La captura muestra el
  health del servicio en `ok` y los assets reales del proyecto.
- **CA-011:** Los componentes del ciclo están en `sdd/components.json` bajo `apps/web` con
  `status: implemented` y su `consumes`, y `pnpm sdd:validate` está en verde.
