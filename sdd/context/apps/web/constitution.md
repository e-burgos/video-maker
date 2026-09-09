# Constitución — apps/web

> Versión 1.1 | Última actualización: spec-e-burgos-006 cycle-01 | Fecha: 2026-09-09
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).

## 1. Propósito

- **Tipo:** app React 19 (SPA local, mono-usuario, sin auth ni despliegue)
- **Rol en el sistema:** el Web Studio — la interfaz con la que el dev opera el motor desde el
  navegador de su propia máquina: biblioteca de assets crudos del proyecto, preview de la
  `Timeline` y disparo/seguimiento de renders locales.
- **No tiene lógica de motor ni toca el filesystem.** Todo lo que muestra y todo lo que escribe
  pasa por los endpoints de `apps/render-api` (`sdd/api.json` → `EP-001`..`EP-015`), su único
  backend. Si hace falta un cálculo, vive en una lib o en la API, nunca acá.

## 2. Stack tecnológico

- React 19 + `react-router-dom` 7 + Tailwind CSS 4 (`@tailwindcss/vite`), Vite 8
- Vitest 4 + jsdom + `@testing-library/react` / `@testing-library/dom`, cobertura `@vitest/coverage-v8`
- **`@testing-library/user-event` NO está instalado**: los tests de interacción usan `fireEvent`.
  No agregarlo sin un motivo que `fireEvent` no cubra.
- **Cero dependencias npm propias** (spec-006 D-2, RNF-1): todo sale del manifiesto raíz. La única
  dependencia npm nueva prevista en toda la spec es `@remotion/player`, en `cycle-02`.
- Tags Nx: `["scope:studio", "type:app"]`; targets `dev`, `build`, `preview`, `lint`,
  `test` (`vitest run --coverage`, jsdom, piso 80 %)

## 3. Estructura y patrones

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

- **`src/api/` es el único lugar que sabe que el servicio existe** (RNF-4). Ningún componente arma
  una URL ni lee un status; nadie fuera de ahí conoce host, puerto ni el prefijo `/api`.
  Verificable: `grep -rn "127.0.0.1\|localhost\|/api/" apps/web/src --include=*.tsx`.
- **El transporte es el proxy de Vite, no una URL absoluta** (D-4): `render-api` **no emite ninguna
  cabecera CORS**, así que un `fetch` de `localhost:4200` a `127.0.0.1:4310` lo bloquea el
  navegador. `vite.config.ts` proxea `/api/*` → `RENDER_API_URL` (default `http://127.0.0.1:4310`)
  quitando el prefijo, en `server` y en `preview`. Consecuencia buscada: las URLs de `EP-011` son
  same-origin, que es lo que necesitan el `<Player>` de Remotion y cualquier `<video>` con `Range`.
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
  segmento: una URL de artefacto no puede salir del proyecto ni aunque el catálogo mintiera.
- **Estado de servidor sin librería** (D-3): `useAsyncResource` (`loading|ready|error` + `reload`)
  con contador de secuencia que descarta la respuesta de un request obsoleto. Sin TanStack Query,
  sin store global. Se revisa en `cycle-03` con el polling de jobs como consumidor real.
- **`media/` nunca se copia a `apps/web/public`** (D-6): todo asset se lee por `EP-011`.

## 4. Convenciones propias

- **Copy, identificadores y README en inglés** (D-7, precedente de `FIX-e-burgos-002-002`); los
  documentos SDD en español. **Sin comentarios** en el código de implementación.
- **`apps/web/eslint.config.mjs` no se crea** (D-9, hook `config-protection`): el proyecto lintea
  contra el flat config raíz y sus boundaries se cumplen por el fallback `type:app` → `*`.
- **Los artefactos de despliegue del generador no vuelven** (D-11): sin `Dockerfile` ni
  `nginx.conf` — el producto es local y `render-api` sólo escucha en loopback.
- **Cada ciclo cierra con al menos una captura real de Playwright** de la UI contra un `render-api`
  real, en `cycles/cycle-XX/artifacts/` (D-10, RNF-5). `lint`/`test`/`build` verdes no prueban que
  la pantalla se dibuje.
- **Cobertura sin recortar el `include`** (RNF-3): `src/**/*.{ts,tsx}` con piso 80 %, excluyendo
  sólo `*.spec.*`, `main.tsx` y `test-setup.ts`.
- Los componentes se registran en `sdd/components.json` bajo la app-key `apps/web` con su
  `consumes` de endpoints.
