# web

The Video Maker Studio: a local React 19 UI that operates the engine through `apps/render-api`.
`cycle-01` of `spec-e-burgos-006-web-studio` delivers the studio shell, the project list and the
raw asset library. The Remotion `<Player>` preview (`cycle-02`) and timeline editing plus render
jobs (`cycle-03`) are not here yet.

**This app has no engine logic and never touches the filesystem.** Everything it shows and
everything it writes goes through the HTTP contract in `sdd/api.json` (`EP-001`..`EP-015`).

## Commands

```bash
pnpm nx run web:lint
pnpm nx run web:test      # vitest run --coverage, jsdom, 80% floor
pnpm nx run web:build
pnpm nx run web:serve
```

## Running it against the service

The app talks to `render-api` **only through the Vite proxy**: the client resolves every URL
against `/api`, and the dev server forwards `/api/*` to `RENDER_API_URL` with the prefix stripped.
`render-api` emits no CORS headers, so a direct cross-origin `fetch` from the browser would be
blocked — the proxy is not a convenience, it is the transport.

```bash
# 1. the service (4310 is taken by `pnpm sdd:docs` on the author's machine)
RENDER_API_PORT=4399 RENDER_API_MEDIA_ROOT=media SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &

# 2. the studio
WEB_PORT=4207 RENDER_API_URL=http://127.0.0.1:4399 pnpm exec vite --config apps/web/vite.config.ts
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `RENDER_API_URL` | `http://127.0.0.1:4310` | Where the dev and preview servers proxy `/api/*` to. |
| `WEB_PORT` / `PORT` | `4200` | Port the studio listens on. |
| `VITE_BASE_PATH` | `/` | Base path, forwarded to the router `basename`. |

## Structure

```
src/
  api/          the render-api boundary: contract types, typed client, error surface, URL builders
  hooks/        useAsyncResource — the only server-state primitive (no query library)
  components/   studio layout, health badge, error notice, asset card/preview/uploader, create form
  pages/        projects-page, asset-library-page
  app/app.tsx   router and provider wiring
```

- **`src/api/` is the only place that knows the service exists.** No component builds a URL or
  reads a status code; nothing outside it knows the host, the port or the `/api` prefix.
- **The contract types are declared here, not imported.** `apps/render-api` is another app and
  `libs/auto-montage` is a Node library that must never enter a browser bundle. The boundary
  between the two apps is the HTTP contract, and its registry is `sdd/api.json`.
- **Every error the UI shows carries the service's own `code`** (37 typed codes), plus three
  transport codes this app owns: `SERVICE_UNREACHABLE`, `RESPONSE_NOT_JSON` and
  `RESPONSE_SHAPE_UNEXPECTED`.
- **`media/` is never copied into `public/`.** Assets are read from `EP-011`, which supports
  `Range` — that is what a `<video>` needs to seek, and what the `<Player>` will need next cycle.
- No comments in the implementation code; UI copy, identifiers and this README are in English.

## Assets the browser can render

`src/api/asset-media-kind.ts` mirrors the closed extension table of
`apps/render-api/src/http/content-type-for.ts` and decides `<video>` / `<audio>` / `<img>` when the
list is painted, with no round-trip per asset. An unknown extension gets a download link, never a
broken player. **If that table changes on the service, change it here too** — the two are a pair.

## Visual verification

`lint`, `test` and `build` green do not prove a screen draws. Every cycle of this spec closes with
real Playwright captures against a live `render-api`, in
`sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-XX/artifacts/`. The literal script, and why
the harness' Playwright MCP could not be used, are in that directory's `visual-verification.md`.

## Known limits (cycle-01)

- **No preview and no rendering yet.** `EP-007`..`EP-015` are not called by any screen.
- **The upload has no progress bar.** `fetch` reports no upload progress without `XMLHttpRequest`;
  a large asset shows `Uploading…` and nothing else. Revisit in `cycle-03` if it hurts.
- **No polling.** The listings refresh on an explicit action (create, upload, retry, health click).
  Job polling arrives in `cycle-03` and is what will decide whether `useAsyncResource` is enough.
- **`vite.config.ts` prints a Vite deprecation warning** (`ESM syntax in a file loaded as
  CommonJS`) shared by every project in this workspace. Not addressed here: it is a workspace-wide
  change, not a change of this app.
