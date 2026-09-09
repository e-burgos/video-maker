# spec-e-burgos-006-web-studio cycle-01 — 2026-09-09

## Estado

- El subproyecto pasa de **placeholder del generador** a app real.
  `resuelve: context_prompt.md § Estado ("recién generado — sin ciclos SDD completados todavía")` y
  `resuelve: constitution.md § PLANTILLA` — las secciones `[...]` de los archivos base las cubre
  este fragmento hasta que el próximo ciclo las consolide.
- **Auditoría del scaffold (lección vigente sobre generadores Nx):** se borraron `Dockerfile` y
  `nginx.conf` (D-11 de la spec: producto local, mono-usuario, `render-api` sólo en loopback) y la
  `HomePage` placeholder; se eliminó el `!` de `main.tsx` (warning preexistente
  `no-non-null-assertion`, hoy un guard explícito). `package.json` y `nx.json` **no** tenían nada
  que podar: `apps/web` no tiene manifiesto propio y sus targets están declarados a mano en
  `project.json`, no inferidos — el `test` nunca estuvo en modo watch, pero sí con
  `--passWithNoTests`, que se reemplazó por `--coverage` al haber suite real.
- La app **levanta y se ve de verdad** contra un `render-api` real: tres capturas de Playwright en
  `cycles/cycle-01/artifacts/` con el guion literal en `visual-verification.md`. Medido en el
  navegador: los dos `<video>` servidos por `EP-011` llegan a `readyState: 4` con `duration` 22.5 s
  y 5 s y `1280×720` — el endpoint sirve bytes decodificables a través del proxy, no sólo un `src`
  bien escrito. El camino de escritura (crear proyecto + upload + duplicado ⇒ `ASSET_ALREADY_EXISTS`)
  se verificó contra un `RENDER_API_MEDIA_ROOT` temporal; `media/` del dev quedó intacto.
- Suite: **15 archivos / 71 tests**, cobertura **99,14 % stmts · 95,78 % branch · 97,53 % funcs ·
  99,55 % lines** con piso 80 % y `coverage.include` `src/**/*.{ts,tsx}` sin recortar (sólo se
  excluyen los `*.spec.*`, `main.tsx` y `test-setup.ts`).
- Alcance **no** cubierto: `<Player>` de Remotion, edición de timeline y jobs de render. La app no
  llama `EP-007`..`EP-015` desde ninguna pantalla.

## Estructura

```
src/
  api/          frontera con render-api: tipos del contrato, cliente tipado, superficie de errores,
                artifact-url, project-slug, asset-media-kind, RenderApiProvider
  hooks/        useAsyncResource (único primitivo de estado de servidor)
  components/   studio-layout · service-health-badge · error-notice ·
                create-project-form · asset-card · asset-preview · asset-uploader
  pages/        projects-page · asset-library-page
  app/app.tsx   router (`/`, `/projects/:slug`) y provider
```

- **`src/api/` es el único lugar que sabe que el servicio existe.** Ningún componente arma una URL
  ni lee un status; nadie fuera de ahí conoce host, puerto ni el prefijo `/api` (RNF-4). Verificable
  con `grep -rn "127.0.0.1\|localhost\|/api/" apps/web/src --include=*.tsx`.
- **El transporte es el proxy de Vite, no una URL absoluta** (D-4): `render-api` **no emite ninguna
  cabecera CORS** (medido: `grep -rn 'access-control' apps/render-api/src/` sin resultados), así que
  un `fetch` de `localhost:4200` a `127.0.0.1:4310` lo bloquea el navegador. `vite.config.ts` proxea
  `/api/*` → `RENDER_API_URL` (default `http://127.0.0.1:4310`) quitando el prefijo, en `server` y
  en `preview`. Consecuencia buscada: las URLs de `EP-011` quedan same-origin, que es lo que el
  `<Player>` de `cycle-02` y cualquier `<video>` con `Range` necesitan.
- **Los tipos del contrato se declaran acá, no se importan** (D-5): `apps/render-api` es otra app y
  `libs/auto-montage` es una lib Node (`node:fs`, `execa`) que no puede entrar a un bundle de
  navegador. La frontera entre las dos apps es el contrato HTTP y su registro es `sdd/api.json`.
- **Superficie de errores:** `RenderApiError` conserva el `code` del servicio (37 códigos) y suma
  exactamente **tres** códigos propios de transporte: `SERVICE_UNREACHABLE` (el `fetch` rechaza),
  `RESPONSE_NOT_JSON` (status de error sin payload tipado) y `RESPONSE_SHAPE_UNEXPECTED` (200 con
  un cuerpo fuera del contrato). La UI nunca muestra una excepción cruda.
- **`asset-media-kind.ts` es un espejo declarado de `apps/render-api/src/http/content-type-for.ts`**:
  misma tabla cerrada de extensiones, usada para elegir `<video>`/`<audio>`/`<img>` al pintar la
  lista (sin round-trip por asset) y para el `content-type` del upload cuando el navegador no lo
  informa. **Si esa tabla cambia en el servicio, hay que cambiarla acá**: son un par, y nada
  automático lo detecta.
- **`artifactUrl` descarta los segmentos `.` y `..`** además de percent-encodear segmento por
  segmento: una URL de artefacto no puede salir del proyecto ni siquiera si el catálogo mintiera.
- **Estado de servidor sin librería** (D-3): `useAsyncResource` (`loading|ready|error` + `reload`)
  con contador de secuencia que descarta la respuesta de un request obsoleto. Sin TanStack Query,
  sin store global. Se revisa en `cycle-03` con el polling de jobs como consumidor real.
- **Copy, identificadores y README en inglés** (D-7, precedente de `FIX-e-burgos-002-002`); los
  documentos SDD en español. Cero comentarios en el código.
- Los 11 componentes están en `sdd/components.json` bajo la app-key `apps/web` (`COMP-001`..`COMP-011`)
  con su `consumes` de endpoints.

## Dependencias

- **Cero dependencias npm nuevas** (D-2, RNF-1, CA-004): `git diff --stat package.json
  pnpm-lock.yaml` vacío en todo el ciclo. React 19, `react-router-dom` 7, Tailwind 4 +
  `@tailwindcss/vite`, `@testing-library/react` + `/dom`, `jsdom` y `@vitest/coverage-v8` ya estaban
  en el manifiesto raíz.
- **`@testing-library/user-event` NO está instalado**: los tests de interacción usan `fireEvent` de
  `@testing-library/react`. No agregarlo sin un motivo que `fireEvent` no cubra.
- **Cero dependencias de workspace**: `apps/web` no importa ninguna `@video-maker/*`. Todavía no
  hace falta declarar el alias en el Vite de la app — eso llega en `cycle-02` con
  `composition-remotion`, y ahí aplica la regla de los tres resolvedores.
- Variables de entorno: `RENDER_API_URL` (default `http://127.0.0.1:4310`), `WEB_PORT`/`PORT`
  (default 4200) y `VITE_BASE_PATH`.
- Config del proyecto: `apps/web/vite.config.ts` pasó a `vitest/config` con bloque `test` (jsdom,
  `setupFiles: ./src/test-setup.ts` con el `cleanup()` de RTL, cobertura con piso 80 %).
  **`apps/web/eslint.config.mjs` no se creó** (D-9, hook `config-protection`): el proyecto lintea
  contra el flat config raíz y sus boundaries se cumplen por el fallback `type:app` → `*`.

## Qué sigue

- **`cycle-02` (`timeline-preview-player`) es el ciclo de riesgo de la spec.** Trae el componente de
  video conmutable (`<Video>` en Player, `<OffthreadVideo>` en render) en
  `libs/composition-remotion` y `@remotion/player`, la única dependencia npm nueva prevista. **Si
  ese cambio altera el contrato que `apps/render-api` o `tools/render-cli` consumen, el ciclo deja
  de ser `lite` y se abre `[FULL]`** (D-8). El smoke y los tests de la lib protegen que la salida
  del render no cambie.
- **`asset-media-kind.ts` y `content-type-for.ts` del servicio son un par sin test que los ate.**
  Si `cycle-02` o `cycle-03` tocan una de las dos tablas, tocar la otra.
- **El upload no reporta progreso**: `fetch` no lo expone sin `XMLHttpRequest`; un asset grande
  muestra `Uploading…` y nada más. Decidir en `cycle-03` si vale el cambio a `XMLHttpRequest`.
- **No hay polling en ninguna pantalla.** Los listados se refrescan por acción explícita. El
  polling de jobs de `cycle-03` es el que decide si `useAsyncResource` alcanza o si entra una
  librería de queries (D-3).
- **`vite.config.ts` imprime un warning de deprecación de Vite** (`ESM syntax in a file loaded as
  CommonJS`) que comparten **todos** los proyectos del workspace. No se tocó acá: es un cambio
  transversal, no de esta app.
- **El MCP de Playwright de este harness no sirve en esta máquina** (necesita la extensión
  "Playwright MCP Bridge"). La verificación visual usa el Playwright cacheado en `~/.npm/_npx` con
  `chromium.launch({ channel: 'chrome' })`, porque el `chromium_headless_shell` que ese build espera
  no está descargado. Guion completo en `cycles/cycle-01/artifacts/visual-verification.md`.
