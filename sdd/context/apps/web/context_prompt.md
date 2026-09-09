# Context Prompt — apps/web

> Entry point para agentes que trabajen sobre `apps/web`.
> Leer junto con `constitution.md` de este directorio **+ `updates/*.md` en orden de nombre**.
> Última actualización: spec-e-burgos-006 cycle-01 | Fecha: 2026-09-09

- **Tipo:** app React 19 (SPA local sobre `apps/render-api`)
- **Estado:** en construcción — `cycle-01` de `spec-e-burgos-006` está `completed` y dejó el shell
  del studio funcionando contra un `render-api` real: cliente HTTP tipado de `EP-001`..`EP-006` y
  `EP-011`, badge de salud, listado y creación de proyectos, y biblioteca de assets por rol con
  reproducción y upload. **Alcance todavía no cubierto:** `<Player>` de Remotion (`cycle-02`),
  edición de timeline y jobs de render (`cycle-03`). La app no llama `EP-007`..`EP-015` desde
  ninguna pantalla.
- **Spec que la gobierna:** `sdd/specs/spec-e-burgos-006-web-studio/spec-e-burgos-006-web-studio.spec.md`
  (D-1..D-11 y el plan de tres ciclos)
- **Backend único:** `apps/render-api` (ver `sdd/context/apps/render-api/` + `updates/`), por el
  proxy `/api` del dev-server. `sdd/api.json` es el contrato.
- **Depende de:** ninguna `@video-maker/*` todavía. `cycle-02` es el primer ciclo que importa una
  lib (`composition-remotion`, para el `<Player>`) y ahí aplica la regla de los tres resolvedores
  de alias — incluido el `resolve.alias` del `vite.config.ts` de esta app.
- **Cómo correr y testear:** `pnpm nx test web` (jsdom + cobertura), `pnpm nx lint web`,
  `pnpm nx build web`; en desarrollo `pnpm nx dev web` con `apps/render-api` levantado.
  Variables: `RENDER_API_URL` (default `http://127.0.0.1:4310`), `WEB_PORT`/`PORT` (default 4200),
  `VITE_BASE_PATH`.
- **Suite al cerrar `cycle-01`:** 15 archivos / 73 tests, 99,14 % stmts · 95,78 % branch ·
  97,53 % funcs · 99,55 % lines, piso 80 %.

## Qué sigue

- **`cycle-02` (`timeline-preview-player`) es el ciclo de riesgo de la spec.** Trae el componente de
  video conmutable (`<Video>` en Player, `<OffthreadVideo>` en render) en
  `libs/composition-remotion` y `@remotion/player`, la única dependencia npm nueva prevista. **Si
  ese cambio altera el contrato que `apps/render-api` o `tools/render-cli` consumen, el ciclo deja
  de ser `lite` y se abre `[FULL]`** (D-8).
- **`asset-media-kind.ts` y `content-type-for.ts` del servicio son un par sin test que los ate.**
  Si un ciclo toca una de las dos tablas, tocar la otra.
- **El upload no reporta progreso**: `fetch` no lo expone sin `XMLHttpRequest`; un asset grande
  muestra `Uploading…` y nada más. Decidir en `cycle-03` si vale el cambio.
- **No hay polling en ninguna pantalla.** Los listados se refrescan por acción explícita. El
  polling de jobs de `cycle-03` decide si `useAsyncResource` alcanza o si entra una librería de
  queries (D-3).
- **`vite.config.ts` imprime un warning de deprecación de Vite** (`ESM syntax in a file loaded as
  CommonJS`) que comparten **todos** los proyectos del workspace: es un cambio transversal, no de
  esta app.
- **El MCP de Playwright de este harness no sirve en esta máquina** (necesita la extensión
  "Playwright MCP Bridge"). La verificación visual usa el Playwright cacheado en `~/.npm/_npx` con
  `chromium.launch({ channel: 'chrome' })`, porque el `chromium_headless_shell` que ese build
  espera no está descargado. Guion completo en
  `sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-01/artifacts/visual-verification.md`.
