# web

The Video Maker Studio: a local React 19 UI that operates the engine through `apps/render-api`.
`cycle-01` of `spec-e-burgos-006-web-studio` delivers the studio shell, the project list and the
raw asset library. `cycle-02` adds the Remotion `<Player>` preview. `cycle-03` adds timeline
editing (clips, captions, music mix, output preset), the save bar, and the full render job flow —
trigger, live progress, and the MP4 download. `cycle-02` of `spec-e-burgos-007-web-montage` closes
the loop: the studio can now **produce** the timeline it used to only consume. `cycle-02` of
`spec-e-burgos-008-ai-storyboard` opens the second way in: a storyboard written by a local AI agent
from an idea or a pasted script, editable scene by scene, with a numbered visual prompt sheet for
the external generative tools. `cycle-02` of `spec-e-burgos-009-voice-over` gives that storyboard a
voice: pick a Piper model, generate one track per scene, listen to each of them with its real
duration, regenerate the scene whose script you just changed, or replace any of them with a
recording of your own.

**The whole product is reachable from the browser:** upload the raw material → generate the montage
→ adjust it → render → download the MP4. `tools/render-cli` is still valid and still supported, but
it is no longer required to reach an MP4.

**This app has no engine logic and never touches the filesystem.** Everything it shows and
everything it writes goes through the HTTP contract in `sdd/api.json` (`EP-001`..`EP-021`).

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
  api/storyboard-edit/ the immutable storyboard editors and the client mirror of its 422 (lazy-only)
  hooks/              useAsyncResource, useApiAction, useRenderJobPoll — the only server-state
                       primitives in this app (no query library)
  components/         studio layout, health badge, error notice, asset card/preview/uploader,
                       create form, timeline editors (clip track, caption, music mix, output
                       preset), issue list, save bar, render trigger, job list, job panel,
                       montage trigger/panel, storyboard trigger/panel and the storyboard editors
                       (header, character sheet, scene, save bar, prompt sheet), voice
                       trigger/panel and the per-scene voice card
  pages/              projects-page, asset-library-page, project-preview-page, storyboard-page,
                       voice-page
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

`apps/web/e2e/montage-smoke.mjs` is its sibling for the montage flow and the one that proves the
product end to end **from raw material**: it copies only `media/smoke-ingest/raw/` into a temporary
media root (no `work/`, no `out/`), then drives library → "Generate montage" → live stage progress →
automatic jump to the preview → a second montage refused with `409` and confirmed in the UI → edit →
save → render → download → `ffprobe`.

```bash
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless' || echo "no heavy"   # memory gate, ≥35% free
node apps/web/e2e/montage-smoke.mjs
```

Both scripts share `apps/web/e2e/smoke-helpers.mjs`. The montage script additionally calls
`loadRootEnv()`, which fills **only** `FFMPEG_PATH`, `FFPROBE_PATH`, `WHISPER_CPP_PATH` and
`WHISPER_MODEL_PATH` from the repo-root `.env` when they are absent from the environment (a prior
`set -a && source .env && set +a` still wins, and no other key is read). Whisper's model has no
`PATH` fallback, so without that variable the montage job fails and `GET /health` reports
`degraded`. Measured on this machine: montage 4,7 s, render 11,7 s. Full literal output, the
screenshots and the byte-identity oracle are in
`sdd/specs/spec-e-burgos-007-web-montage/cycles/cycle-02/artifacts/montage-smoke.md`.

It resolves Playwright from `~/.npm/_npx/*/node_modules/playwright` at runtime (never added to
`package.json`) and cleans up after itself unconditionally (`try`/`finally`): browser closed, both
child processes killed, temp directory removed. See
`sdd/specs/spec-e-burgos-006-web-studio/cycles/cycle-03/artifacts/studio-smoke.md` for the full
literal output, screenshots, and the two tooling bugs it caught (documented there so nobody has to
rediscover them: a `Page.waitForFunction` argument-order mistake, and Vite's dev-server dependency
optimizer firing a full page reload mid-poll).

## Storyboard (spec-008 cycle-02)

`/projects/:slug/storyboard` is the generative mode: the project's second way in, next to the
montage. It is reached from the project nav in the studio header (`library · storyboard · preview`)
and from the asset library.

- **One panel proposes, one panel follows.** `StoryboardTrigger` sends the same
  `POST /projects/:slug/jobs` (`EP-012`) with `{"kind":"storyboard","brief"|"scriptText","overwrite"}`
  — exactly one of `brief` (an idea) or `scriptText` (a script already written, typed, pasted or
  loaded from a `.txt`/`.md` file). `StoryboardJobPanel` polls it on the same `useRenderJobPoll` and
  names the three stages `collect | propose | persist`. **`propose` is a real model call and takes
  more than a minute** (measured 62-79 s on this machine); the panel says so on screen, before and
  during the wait, so the wait never looks like a hang.
- **Agent failures are translated, not dumped.** `storyboardFailureExplanation()`
  (`src/api/storyboard-capability.ts`) pairs each typed code with a sentence in the user's language:
  `AI_AGENT_UNAVAILABLE` (install Claude Code), `AI_AGENT_RATE_LIMITED` (the subscription quota
  reset, nothing was lost), `AI_AGENT_FAILED` and `AI_AGENT_INVALID_OUTPUT` (transient, propose
  again). The code itself stays on screen next to it.
- **The 409 is handled, not prevented**, exactly as the montage does: the job is sent, and
  `409 STORYBOARD_ALREADY_EXISTS` becomes the overwrite confirmation. The storyboard is the one
  document the user edits by hand, so replacing it is always an explicit act.
- **The document is edited in place and saved with one full `PUT`** (`EP-017`): title, language,
  format, caption style and music tags; the character sheet; and per scene the narration, the
  visual prompt, the visual source (`upload | asset | remotion-scene`), its `assetId` or native
  Remotion scene with the props its `kind` requires, the estimated duration, the per-scene caption
  style and the tag lists. `storyboardIssues()` is the **client mirror of the server's 422**: it
  runs the very same `StoryboardDocumentSchema` from `libs/timeline-core` and blocks the save with
  the offending path written on screen. Switching a visual source drops the fields the new one does
  not declare, and changing a Remotion scene kind replaces the whole scene, so no prop of the old
  kind survives.
- **The prompt sheet is copied, never rebuilt.** "Copy prompts" fetches `EP-018` and puts the
  `text/plain` body on the clipboard byte for byte; "Show prompts" renders the same text, which is
  also the fallback when the browser refuses clipboard access. Each scene has its own `copy prompt`
  button for its `visualPrompt` alone. The numbering from `01` is the service's, because it is what
  the batch import of `spec-e-burgos-010` will read back (`01.mp4` → scene 1).
- **Health gates the button.** `storyboardBlockers()` disables "Propose storyboard" and names the
  reason when the service reports `capabilities.storyboardQueue: false`. It deliberately ignores the
  four media binaries: the agent uses none of them (D-12 of `spec-008`).
- **The page is lazy, like the preview.** Zod and `@video-maker/timeline-core` must not enter the
  shell chunk. Measured with `vite build` in this cycle: initial chunk 470 kB (466 kB before it),
  `storyboard-page` 33 kB, `project-preview-page` 364 kB and a 110 kB chunk shared by the two lazy
  routes, with no "chunks larger than 500 kB" warning. The client's `getStoryboard` therefore uses
  the same shallow shape check as `getTimeline` and the page validates the document itself.
- **Every control carries an explicit `aria-label`.** React renders a `<textarea>`'s value and a
  `<select>`'s options as children of the wrapping `<label>`, so without it the accessible name is
  the label text **plus the current value** — which silently breaks exact selectors in Playwright.

### The storyboard E2E

```bash
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless' || echo "no heavy"   # memory gate
node apps/web/e2e/storyboard-smoke.mjs
```

`apps/web/e2e/storyboard-smoke.mjs` runs against a real `render-api`, a real Chrome and a **real
`claude -p` call** on a temporary copy of `media/smoke-ingest/raw/`: project nav → empty state →
brief → job with live stages → the storyboard rendered on screen → one narration edited → the `PUT`
verified by reading `work/storyboard.json` **on disk** → the prompt sheet copied and read back from
the clipboard and compared byte for byte with the served text → the per-scene copy → a second
proposal refused with `409` and confirmed in the UI. If the subscription quota answers `429`, the
script verifies the failure branch on screen, screenshots it and stops there instead of failing
silently. Artifacts (the produced document, the copied sheet and five screenshots) land in
`sdd/specs/spec-e-burgos-008-ai-storyboard/cycles/cycle-02/artifacts/`.

## Producer (spec-015 cycle-02)

`/projects/:slug/producer` is **the first stop of a project**: the projects list opens every card
here and the project nav starts with it (`producer · library · storyboard · voice · preview`). It is
the chat where you say what video you want, the producer agrees the plan with you and then does the
work — reads the material, writes the script, voices it, runs the montage and renders the MP4 — on
this machine, with the local Claude subscription and no API key.

```bash
# 1. the service (it is what runs the producer; RENDER_API_URL is also what the agent calls back)
RENDER_API_PORT=4399 RENDER_API_MEDIA_ROOT=media RENDER_API_URL=http://127.0.0.1:4399 \
  SWC_NODE_PROJECT=tsconfig.base.json PRODUCER_MODEL=sonnet \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &

# 2. the studio
WEB_PORT=4207 RENDER_API_URL=http://127.0.0.1:4399 pnpm exec vite --config apps/web/vite.config.ts

# 3. open http://localhost:4207/projects/<slug>/producer
```

- **A turn takes minutes, not seconds.** The page polls `EP-024` every 2.5 s (its own
  `useProducerTurnPoll`, a `setTimeout` re-armed after each answer — never a `setInterval`) and
  shows every event the agent emits with its readable summary (`ffprobe raw/broll/lentes.mp4`,
  `queued montage job`), the elapsed clock and a **Cancel** button that kills the child process
  (`EP-025`) and keeps polling until the turn really settles as `canceled`.
- **The turn is not a job.** It has no `kind`, no `state` and no `progress`, so it never entered the
  `Job` union: forcing it in would have brought back the optional-fields anti-pattern the studio
  banned. The jobs the agent enqueues **are** read from the real job listing and shown while the
  turn runs.
- **Answering is one click.** The `suggestions` of the answer become chips, and if the producer
  wrote numbered options (`1. … 2. …`) those become chips too. Clicking one sends that exact text.
  Only the last answer offers chips — an old turn is history, not a menu.
- **Markdown is ours and it is small**: paragraphs, ordered and unordered lists and bold, parsed by
  `src/api/producer-markdown.ts`. No npm dependency was added and nothing is rendered as HTML.
- **An empty conversation is a briefing, not a blank page.** `ProducerWelcome` lists the real
  inventory of the project by role (from `EP-005`) and offers starters that land in the composer so
  you can finish them in your own words. With no material at all it points at the library instead.
- **Every producer failure is shown with its code and a sentence.** `429 PRODUCER_RATE_LIMITED`
  says the Claude subscription ran out of quota **and that the conversation is saved on disk**;
  `503 PRODUCER_UNAVAILABLE` blocks the composer with the reason written, driven by
  `capabilities.producer` of `EP-001`.
- **The studio refreshes itself when a turn ends**: conversation, asset listing and job listing are
  reloaded, so the preview shows the timeline the producer just built without a manual reload.

### The producer E2E

`node apps/web/e2e/producer-smoke.mjs` runs the whole thing against a real `claude -p` over a
**temporary copy** of `media/demo-01` (`raw/` and `work/producer/`, never the developer's own
project): empty state → turn 1 → chips → turn 2 with the montage and render jobs → the MP4 in
`out/` probed with `ffprobe` → the logo saved from the preview → a third turn canceled from the UI.
It costs two real turns of several minutes each, so run one E2E at a time and never with another
render alive. `PRODUCER_SMOKE_STOP_AFTER=4` stops right after the empty state: it exercises the copy,
both servers, the navigation and the inventory assertions **without spending a single token**, which
is the cheap way to check the script before paying for it.

## Logo overlay (spec-015 cycle-02)

The preview page owns the logo, because that is where the timeline-editing machine already lives
(reducer, dirty flag, issue severity and the single full `PUT`). "Show logo" and the position
selector write `timeline.logo` **and** push the logo `MediaAsset` into `timeline.assets` —
`validateTimeline` rejects a logo whose `assetId` is not among the assets or is not an image. The
control is enabled only when the catalog has a **probed** logo (`role: "logo"`, `media !== null`);
with a project that only has a raw scan it says so instead of failing silently, and the same panel
uploads a logo with the role already fixed (`EP-006` accepts `logo` since this cycle).

## Voice-over (spec-009 cycle-02)

`/projects/:slug/voice` is where the storyboard gets a voice, reached from the project nav
(`producer · library · storyboard · voice · preview`) or from the asset library's "open voice" link. It is a
page of its own and not a panel of the storyboard: the two documents have different lifecycles —
one is edited by hand, the other is produced by a job — and the storyboard page was already full.

- **The voice is the clock of the video.** Every scene shows the duration `ffprobe` measured on its
  track next to the `estimatedDurationMs` the model proposed, and the signed gap between them. In
  the measured E2E run all five scenes came out **shorter** than estimated, by 0.35 s to 2.02 s.
- **One panel generates, one panel follows.** `VoiceTrigger` lists the installed models with
  `GET /voices` (`EP-019`) — since `spec-016 cycle-01` as the **audible cards** of `VoicePicker`,
  not a `<select>` of file names — marks the one `PIPER_MODEL_PATH` points at as `default`, and sends
  `POST /projects/:slug/jobs` with `{"kind":"voice","voice","overwrite"}`. `VoiceJobPanel` polls it
  on the same `useRenderJobPoll` and reports the stages `synthesize | transcribe | persist` **with
  the per-scene counter** the service emits.
- **An empty catalogue and an unconfigured Piper are different things.** `EP-019` answers
  `503 VOICE_MODEL_UNAVAILABLE` for the second, and the page says which of the two happened instead
  of showing an empty selector either way.
- **`Job` gains its fourth branch, not an optional.** `VoiceJob` carries `VoiceJobProgress`
  (`processedScenes`/`totalScenes`) and `VoiceJobReport` of its own, mirroring
  `apps/render-api/src/jobs/render-job.ts`; `parseVoiceJob` rejects the other three kinds. A new
  kind is still added in the three places: the union, the parser and the panel that shows it.
- **The 409 is handled, not prevented** — same pattern as the montage and the storyboard.
  `409 VOICE_ALREADY_EXISTS` becomes an overwrite confirmation that warns it also replaces the takes
  you recorded yourself.
- **Staleness is the service's answer, not a client guess.** `EP-020` returns a `stale` flag per
  scene, computed against the narration hash stored in the manifest. A stale scene is flagged with
  the reason written and its "Regenerate this scene" button sends `sceneIds: [that scene]` with
  `overwrite: true` **and the voice that track was already synthesized with**, not the global
  default. The E2E verifies by `sha256` that the other four wav files stay byte-identical: Piper
  adds different noise per run, so an identical hash proves the file was not rewritten.
- **"Use my recording" is one gesture over two endpoints.** The card embeds an `AssetUploader`
  pinned to the `voice` role (`EP-006`) and attaches the stored file to the scene with `EP-021` in
  the same move; a take already sitting under `raw/voice/` can be picked from the select instead.
  The scene then reads `uploaded · my own recording` and its manifest entry carries
  `source: "uploaded"` with `voiceId: null`.
- **Health gates the button.** `voiceBlockers()` (`src/api/voice-capability.ts`) disables "Generate
  voice-over" and names the reason when `capabilities.voiceQueue` is false or any of the **six**
  binaries the pipeline needs is unresolved — `ffmpeg`, `ffprobe`, `whisperCli`, `whisperModel`,
  `piperCli`, `piperModel`. The health badge lists all six with their env var, never a resolved path.
- **The page is lazy.** It needs no Zod (the manifest is validated with structural guards, like the
  jobs) but the initial chunk was already at 470 kB against Vite's 500 kB warning. Measured after
  this cycle: initial 474 kB, `voice-page` 20 kB, `storyboard-page` 33 kB,
  `project-preview-page` 364 kB, with no size warning.

### The voice E2E

```bash
node apps/web/e2e/voice-smoke.mjs
```

Real `render-api`, real Chrome, real Piper and real whisper-cli, over a temporary copy of
`media/smoke-ingest/raw/` seeded with a `storyboard.json` produced by an earlier run — **no
`claude -p` call**. It gates on no live `ffmpeg|whisper-cli|piper|chrome-headless` process and on
at least 35% free memory (read from `memory_pressure`'s own free percentage, never its pressure
level), then walks: project nav → empty state → default voice selected → generate → live stages and
per-scene counter → **the five `<audio>` elements measured in the browser** (`readyState`,
`duration`; a good `src` and a 404 look the same in a screenshot) → real versus estimated durations
→ a narration edited on the storyboard page and saved → the `stale` flag on exactly that scene →
regenerate it alone, verified by `sha256` on disk → a take uploaded and attached, verified in
`work/voice/manifest.json`. Evidence and five screenshots land in
`sdd/specs/spec-e-burgos-009-voice-over/cycles/cycle-02/artifacts/`.

## Choosing a voice and choosing a role (spec-016 cycle-01)

Two places where the studio used to speak the engine's language and now explains itself.

- **Voices are cards, not file names.** `VoicePicker` (`src/components/voice-picker.tsx`) renders one
  card per installed model with the readable `label`, the BCP47 language, the quality and a factual
  description, all of them **derived by the service from the `.onnx.json` of the model** — nothing is
  invented, and no gender, age or temperament is stated, because Piper does not document them. A
  model with no sidecar is described from its file name and the card says so.
- **The play button is the point.** Each card owns an `<audio preload="none">` pointed at `EP-026`
  (`/api/voices/<id>/preview` through the dev-server proxy). The first click synthesizes the demo on
  the machine and caches it; later clicks are instant. Only one voice sounds at a time, the button
  reports `Play | Loading… | Stop | Retry`, and a preview the service could not produce is explained
  on the card instead of failing silently.
- **Measured, not assumed** (see "The voices E2E" below): first request 1.3-1.7 s, second request
  3-6 ms from the service cache, both byte-identical; in the browser `readyState` 4 and durations of
  2.93 s and 3.37 s for the two voices played.
- **Every upload role says what it does to the video.** The `AssetUploader` selector is a card per
  role with a readable name, the `raw/<role>/` directory it lands in, a one-line impact on the final
  video, a `required` badge on A-roll and the B-roll matching rule written out. The copy lives in
  **one module**, `src/api/asset-roles.ts` (same precedent as `montage-presets.ts`), so a new role
  breaks the type in a single place and `cycle-02` can translate one file instead of six components.

### The voices E2E

```bash
node apps/web/e2e/voices-smoke.mjs
```

Real `render-api` on port 4411 over a temporary media root, real Chrome, real Piper, a **temporary
`PIPER_PREVIEW_CACHE_DIR`** and no `claude -p`. It gates on memory and stray processes like the
others, then: asserts `GET /voices` carries `previewUrl` (a field only this build emits, so a stale
server cannot pass), lists the three installed voices with their label, language and quality, times
a cache miss against a cache hit on the voice the browser never touches, checks the typed
`404 VOICE_NOT_FOUND`, reads the six role cards in the asset library, and finally **plays two voices
in the browser measuring `readyState` and `duration` on the `<audio>` element** — never the
screenshot, never the `src`. Three screenshots land in
`sdd/specs/spec-e-burgos-016-studio-usability/cycles/cycle-01/artifacts/`.

## Language and guide (spec-016 cycle-02)

The studio reads in English or Spanish. The switch lives in the header next to the health badge;
the choice is persisted in `localStorage` under `video-maker.language` and stamped on
`<html lang>`. With nothing stored, a browser whose `navigator.languages` starts with `es-*` opens
in Spanish and anything else opens in English.

There is **no i18n dependency**. The whole mechanism is `src/i18n/`:

| File | What it holds |
| --- | --- |
| `messages-en.ts` | The English catalog, and the **type**: `TranslationKey = keyof typeof MESSAGES_EN`. |
| `messages-es.ts` | The Spanish catalog, declared `Messages = Readonly<Record<TranslationKey, string>>`. |
| `translate.ts` | `t(key, params)` with `{param}` interpolation and `tn(key, count)` for plurals. |
| `language.ts` | The supported languages, the detection order and the storage. |
| `language-context.tsx` | `LanguageProvider`, `useLanguage()`, `useT()`, `useTn()`. |

### Adding a key

1. Add it to `messages-en.ts`. That alone makes `messages-es.ts` fail to compile until the Spanish
   text is there: the Spanish catalog is typed against the English one, so **a missing key and an
   unknown key are both type errors**, in both directions.
2. Use it: `const t = useT();` and then `t('my.key')`, or `t('my.key', { slug })` when the sentence
   carries a value. Never concatenate a translated string with a value — put the value in the
   template as `{slug}` so word order can differ between languages.
3. For a count, declare `my.key.one` and `my.key.other` and call `tn('my.key', count)`. `{count}` is
   injected for you.
4. Run `pnpm nx test web`. `messages-parity.spec.ts` also checks, at runtime, that no translation is
   empty, that both languages carry the same placeholders, and that no plural is half declared.

### Adding a language

Add the code to `LANGUAGES` in `language.ts`, write `messages-<code>.ts` typed as `Messages` (the
compiler lists every key you still owe), add its branch to `loadMessages` in `language-context.tsx`
and its name to `language.name.<code>` in every catalog, and write `guide/guide-content-<code>.ts`
plus its branch in `loadGuideContent`. Load it **lazily**, like Spanish: a full catalog is ~26 kB
and the initial chunk has about 10 kB of room before the 500 kB warning comes back.

### What is not translated, on purpose

- What the producer agent writes: it already answers in the language of the user.
- The `label` and `description` of a voice: `GET /voices` publishes them from the model metadata,
  they are catalog data, not UI copy.
- The `message` of a service error: it is shown as a technical line under the translated explanation
  of its `code`, and the `code` itself is never translated. Same for every other technical id
  (`youtube-16x9`, `aroll`, `raw/broll/`, job stages).

### No literal copy

`no-literal-copy.spec.ts` reads every `.tsx` under `src/app`, `src/components` and `src/pages` with
`import.meta.glob(..., { query: '?raw' })` and fails if any of them writes copy straight into the
markup: JSX text, or a `placeholder`, `title`, `aria-label` or `alt` string with three or more
letters in a row that is not a known technical token. The scanner itself is
`src/i18n/literal-copy-scan.ts`, and `literal-copy-scan.spec.ts` proves it catches planted copy
rather than only accepting the current tree. It is a plain test, not an ESLint rule: this app does
not own an `eslint.config.mjs` (D-9) and the root config is protected.

### The guide

`/guide` explains what each section of the studio decides, plus the output preset table and three
worked flows. The content is `src/guide/guide-content-{en,es}.ts`, loaded lazily by the route and
rendered with `ProducerMarkdown` — the same minimal markdown the producer already speaks, tables
included. `guide-content.spec.ts` fails if a section is missing, if a language drifts out of
structure, or if a montage or output preset stops being tabulated with its id and its readable name.

Evidence: `node apps/web/e2e/i18n-smoke.mjs` (ports 4415/4416) drives a real Chrome against a real
`render-api`: it switches to Spanish, reads the nav, the upload roles, the producer welcome and the
voice cards in Spanish, reloads to prove the choice persists, and opens the guide in both languages.

## Montage (spec-007 cycle-02)

The asset library owns the montage. `MontageTrigger` calls the same `POST /projects/:slug/jobs`
(`EP-012`) the render uses, with `{"kind":"montage","preset","seed","overwrite"}`; the service runs
`ingestProject` + `autoMontage` and writes `work/catalog.json`, `work/timeline.json` and
`work/edl.json`.

- **Preset and seed are picked in the UI.** The four preset names (`software-demo`, `hardware`,
  `recipe`, `educational`) are declared in `src/api/render-api-types.ts`, derived from
  `MONTAGE_PRESETS` of `libs/auto-montage` — that library is a Node library and must never enter a
  browser bundle. The seed must be a non-negative integer, checked before the request is sent.
- **The 409 is handled, not prevented.** The button never inspects `layout.timeline` to decide
  whether a timeline already exists: it sends the job and treats `409 TIMELINE_ALREADY_EXISTS` as
  the confirmation prompt ("this overwrites the edited timeline"), retrying with `overwrite: true`
  only after the dev confirms. The service guarantees no job is registered and no byte is touched
  in that case, so the disk is the source of truth, never a stale client-side flag.
- **`MontageJobPanel` polls the same `useRenderJobPoll`** as the render, now typed on the
  discriminated union `Job = RenderJob | MontageJob`. A montage job reports the stages
  `discover | probe | transcribe | plan` and the counters `processedAssets`/`totalAssets` — never
  `renderedFrames`/`totalFrames`, which is why the union is discriminated rather than one type with
  optional fields. When the job settles as `succeeded` the studio navigates to the preview.
- **Health gates the button.** `montageBlockers()` (`src/api/montage-capability.ts`) disables
  "Generate montage" and names the reason when the service reports `capabilities.montageQueue:
  false` or leaves any of the four media binaries unresolved. The health badge's `details`
  disclosure lists the engine modules, the four binaries with their env var (never a resolved host
  path) and every capability.
- **A project with no timeline shows an empty state, not an error.** `/projects/:slug/preview`
  answers `TIMELINE_NOT_FOUND` with a panel that links back to the library to generate the montage;
  every other read failure still renders the `ErrorNotice` with its code.

## Known limits

- **The Player's default framing now matches the render's** (`PLAYER_MEDIA_STYLE = { objectFit:
  'fill' }`, `libs/composition-remotion`, D-12) — the preview/render mismatch this bullet used to
  describe is gone. What is **not** fixed: `fill` stretches a clip whose aspect ratio doesn't match
  the output canvas anamorphically, in both the Player and the render — that is the render's actual
  framing bug, deliberately left out of this cycle's scope. See
  `libs/composition-remotion/README.md`'s D-12 note before touching this.
- **The voice-over cannot be cancelled from the UI.** `EP-015` supports it and the job may run for
  half a minute over five scenes, but no acceptance criterion asks for it — the same gap the
  storyboard panel has.
- **There is no way back from an uploaded take to a generated one for a single scene.** The service
  has no `DELETE` for a scene track, so the only route is regenerating the whole voice-over with
  `overwrite: true`, which also replaces every other take.
- **The upload has no progress bar.** `fetch` reports no upload progress without `XMLHttpRequest`;
  a large asset shows `Uploading…` and nothing else.
- **`vite.config.ts` prints a Vite deprecation warning** (`ESM syntax in a file loaded as
  CommonJS`) shared by every project in this workspace. Not addressed here: it is a workspace-wide
  change, not a change of this app.
- **The montage asset counter is never populated in practice.** `processedAssets`/`totalAssets`
  arrive as `null` in every stage of the two measured runs, so the panel shows the stage but no
  counter. The UI renders it as soon as the service sends it; the gap is in `apps/render-api`'s
  `CommandRunner` decorator, not here. No acceptance criterion of the spec requires the counter.
