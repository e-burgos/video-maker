# web

The Video Maker Studio: a local React 19 UI that operates the engine through `apps/render-api`.
`cycle-01` of `spec-e-burgos-006-web-studio` delivers the studio shell, the project list and the
raw asset library. `cycle-02` adds the Remotion `<Player>` preview. `cycle-03` adds timeline
editing (clips, captions, music mix, output preset), the save bar, and the full render job flow —
trigger, live progress, and the MP4 download.

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
  api/                the render-api boundary: contract types, typed client, error surface, URL builders
  api/timeline-edit/  the timeline-editing rules, the reducer and its state (lazy-only, see below)
  hooks/              useAsyncResource, useApiAction, useRenderJobPoll — the only server-state
                       primitives in this app (no query library)
  components/         studio layout, health badge, error notice, asset card/preview/uploader,
                       create form, timeline editors (clip track, caption, music mix, output
                       preset), issue list, save bar, render trigger, job list, job panel
  pages/              projects-page, asset-library-page, project-preview-page (the studio itself)
  app/app.tsx         router and provider wiring
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
  `Range` — that is what a `<video>` needs to seek, and what the Remotion `<Player>` uses.
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

## Timeline preview (Remotion Player)

`/projects/:slug/preview` reads the persisted timeline from `EP-007` and mounts it in a Remotion
`<Player>` with **the same composition the render uses** (`TimelineComposition` from
`@video-maker/composition-remotion`), so a-roll, b-roll, transitions and kinetic captions come from
one source of truth.

- **`@remotion/player` is pinned to the exact `remotion` version** (`4.0.522`). It shares Remotion's
  internal context; a different version breaks at runtime with no type error.
- **The composition is wrapped in `<VideoBackendProvider backend="player">`**, which is what makes
  the tree mount `<Video>` instead of `<OffthreadVideo>`. The provider is never mounted by the
  render, whose default stays `render` — the render output is unchanged, byte for byte.
- **Assets are rewritten to absolute same-origin `EP-011` URLs** before mounting
  (`src/api/player-timeline.ts`). The library's `assetSrc` would otherwise call `staticFile()` for a
  relative path — resolving against this app's empty `public/` — or build a `file://` URL the
  browser cannot load. Same-origin is what makes `Range` work without CORS (D-4).
- **Audio: the player mixes, it does not master.** The composition mounts `AudioTrack` in its
  default `mix` mode, so the preview plays the voice at each clip's `gainDb` and the music through
  the timeline's ducking automation (measured: `volume 0.0631` = -24 dB). The `-14 LUFS`
  `loudnorm` of the deliverable runs in `libs/media-local` and is **not** reproduced in the browser.
- **The 9:16 / 16:9 selector is preview-only.** `previewFormat()` swaps `format` **and** `safeZone`
  together and never writes: the persisted 9:16 safe zone on a 16:9 canvas would push the captions
  out of frame. Nothing is sent to `EP-008`.
- **The route is code-split** (`React.lazy`): the Player, Remotion and the composition are a 441 kB
  chunk that only this route loads, so the projects and asset screens keep their original bundle.
  `TimelineSchema` is likewise only imported by `src/api/parse-timeline.ts`, which is reached from
  this chunk.

## Timeline editing (cycle-03)

The studio page (`project-preview-page.tsx`) owns one `timelineEditReducer` (`useReducer`,
`src/api/timeline-edit/timeline-edit-state.ts`) that every editor dispatches into through a single
callback — no editor talks to the API directly:

- **`ClipTrackEditor`** edits trim start (ms) and duration (frames) per clip, and reorders a-roll
  clips. Duration edits are rejected client-side if they would leave a clip shorter than the
  transitions touching it (`rejectDurationAgainstTransitions`).
- **`CaptionEditor`** edits caption words.
- **`MusicMixEditor`** edits the music's base/ducked gain (dB); the ducking automation is rescaled
  to the new levels, not just the two numbers.
- **`OutputPresetSelector`** switches the output preset (`applyOutputPreset`); it never imports Zod
  and never reads `TimelineSchema` — a preset switch does not need the lazy `timeline-edit` chunk to
  stay cheap to switch back and forth.
- **`TimelineIssueList`** shows every issue on the draft, including `VOICE_TRACK_NOT_MIRRORED` — a
  client-only code outside `timeline-core`'s closed `TimelineIssueCode` union, added when the voice
  track can't be safely re-derived from a-roll (mismatched clip counts). Each issue's severity
  (`save-blocking` | `render-blocking`) decides what it blocks: a render-blocking issue still lets
  you save, it only blocks the render trigger.
- **`TimelineSaveBar`** is the only component that calls `PUT /projects/:slug/timeline` (`EP-008`).
  It is disabled while there are no changes, a save-blocking issue exists, or a save is already in
  flight (`data-testid="timeline-save-bar"`, `data-timeline-dirty` for tests and the E2E smoke).

A-roll edits go through `relayoutArollTrack`: it recomputes every clip's `from` from durations and
the transitions between them, mirrors the voice track onto the new a-roll layout, and clamps b-roll
and music clips to the new total duration. **It does not clamp captions** — shortening a-roll a lot
without also shortening or removing the captions scheduled past the new duration is a real gap; see
`apps/web/e2e/studio-smoke.mjs` for how the cycle-03 smoke works around it (it shortens every a-roll
clip, not just the first, before rendering).

## Render jobs (cycle-03)

- **`RenderTrigger`** calls `POST /projects/:slug/jobs` (`EP-012`). Disabled unless the timeline is
  clean and issue-free (`canStartRender`); on success it hands the created `RenderJob` up so the
  page can select it.
- **`RenderJobList`** calls `GET /projects/:slug/jobs` (`EP-013`) via `useAsyncResource`, with an
  explicit `Refresh` button; selecting a row's id feeds `RenderJobPanel`.
- **`RenderJobPanel`** polls `GET /jobs/:jobId` (`EP-014`) via `useRenderJobPoll` — `setTimeout`,
  never `setInterval`, with a sequence guard so a stale response can't overwrite a newer job
  selection. It shows `renderedFrames`/`totalFrames` only while `progress.stage === 'render'`
  (`showsFrameProgress`), the terminal `error.code` on `failed`, a `Download` link to `EP-011`
  (`GET /projects/:slug/files/out/:jobId.mp4`) on `succeeded`, and a `Cancel` button
  (`DELETE /jobs/:jobId`, `EP-015`) while the job isn't in a terminal state.
- **`useApiAction`** is the one hook every imperative action (save, create job, cancel job) is built
  on: it never throws, exposes a typed `error` and a sequence-guarded `status`, and resets
  `mountedRef` to `true` on every mount — not just `false` on unmount — so it recovers correctly
  from React 18 `StrictMode`'s development-only double-invoke of effects (fixed in cycle-03; see
  `use-api-action.spec.ts`'s `StrictMode` regression test).

## Running the E2E smoke

`apps/web/e2e/studio-smoke.mjs` drives the whole flow above against a **real** `render-api` and a
**real** Chrome, on a temporary copy of `media/smoke-ingest` (never the dev's own `media/`):
create/open a project → asset library → preview → edit all four editors → save → shorten the a-roll
further → save again → trigger a real render → observe live progress → download the MP4 → `ffprobe`
its video and audio streams. It is never run by CI or by `nx test` — it needs a real render-api, a
real browser and, for the render step, real `ffmpeg`/Remotion rendering, so it stays a manual,
deliberately-run script:

```bash
node apps/web/e2e/studio-smoke.mjs
```

It resolves Playwright from `~/.npm/_npx/*/node_modules/playwright` at runtime (never added to
`package.json`) and cleans up after itself unconditionally (`try`/`finally`): browser closed, both
child processes killed, temp directory removed. See
`sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-03/artifacts/studio-smoke.md` for the full
literal output, screenshots, and the two tooling bugs it caught (documented there so nobody has to
rediscover them: a `Page.waitForFunction` argument-order mistake, and Vite's dev-server dependency
optimizer firing a full page reload mid-poll).

## Known limits

- **The Player's default framing now matches the render's** (`PLAYER_MEDIA_STYLE = { objectFit:
  'fill' }`, `libs/composition-remotion`, D-12) — the preview/render mismatch this bullet used to
  describe is gone. What is **not** fixed: `fill` stretches a clip whose aspect ratio doesn't match
  the output canvas anamorphically, in both the Player and the render — that is the render's actual
  framing bug, deliberately left out of this cycle's scope. See
  `libs/composition-remotion/README.md`'s D-12 note before touching this.
- **The upload has no progress bar.** `fetch` reports no upload progress without `XMLHttpRequest`;
  a large asset shows `Uploading…` and nothing else.
- **`vite.config.ts` prints a Vite deprecation warning** (`ESM syntax in a file loaded as
  CommonJS`) shared by every project in this workspace. Not addressed here: it is a workspace-wide
  change, not a change of this app.
- **`vite.config.ts` prints a Vite deprecation warning** (`ESM syntax in a file loaded as
  CommonJS`) shared by every project in this workspace. Not addressed here: it is a workspace-wide
  change, not a change of this app.
