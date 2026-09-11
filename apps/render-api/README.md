# render-api

HTTP service that fronts the media project store and orchestrates the render pipeline: silent
render + mastered audio mix + mux + loudness verification over a project under
`media/<project-slug>/`. Closes `spec-e-burgos-005-render-service`: `cycle-03` adds the render
job queue (`POST`/`GET /projects/:slug/jobs`, `GET`/`DELETE /jobs/:jobId`), per-frame progress and
cooperative cancellation on top of the asset store (`cycle-02`) and the render pipeline
(`cycle-01`, `runRenderPipeline`, now wired to an HTTP route for the first time).

`spec-e-burgos-007-web-montage` (`cycle-01`) adds a second job `kind` to the same queue: a
`montage` job runs `ingestProject` (asset discovery, probing, transcription) and `autoMontage`
(`@video-maker/auto-montage`) over a project that has no `Timeline` yet, producing the same
`work/catalog.json` / `work/timeline.json` / `work/edl.json` a `tools/render-cli ingest && plan`
run would — with the same bytes (RF-4, RNF-1). A `render` job can then be chained on the result,
unmodified. See "Montage jobs" below.

## Commands

```bash
pnpm nx run render-api:lint
pnpm nx run render-api:test
pnpm nx run render-api:build
pnpm nx run render-api:serve
```

`serve` is convenient for development, but **does not propagate the process' real exit code**: Nx
normalizes every `nx:run-commands` failure to `1`. To observe an exact exit code (for example when
verifying CA-002 or CA-017) the binary has to be invoked directly, never through `nx run`:

```bash
SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts
```

`server-register.cjs` registers `@swc-node/register` scoped to `.ts` files and hands back the
native `.js` loader as soon as it is done — that is what lets Remotion bundle with webpack in the
same process without `@swc-node/register` trying to compile the third-party `.js` files it
injects.

## Environment variables

| Variable | Default | Rule |
| --- | --- | --- |
| `RENDER_API_HOST` | `127.0.0.1` | Any non-empty string is used as-is. The default never listens outside loopback: opening it up is an explicit operator decision. |
| `RENDER_API_PORT` | `4310` | Integer `0..65535`. Empty or unset uses the default. Present and invalid (not an integer, or out of range) aborts startup with `SERVER_CONFIG_INVALID` — it never falls back to the default silently. |
| `RENDER_API_MEDIA_ROOT` | `media` (resolved against `process.cwd()`) | An absolute value is kept as-is. This is the root the asset store confines every storage operation to (`ASSET_PATH_INVALID` if a resolved path ever escapes it), and the root every render job's `projectRoot` resolves under. |
| `RENDER_API_MAX_UPLOAD_BYTES` | `2147483648` (2 GiB) | Positive integer number of bytes. Zero, negative or non-numeric aborts startup with `SERVER_CONFIG_INVALID`. Enforced twice: from the `content-length` header before the first byte is read, and again while the body streams in, in case the header understated the real size. |
| `RENDER_API_OBJECT_STORE` | `fs` | Only `fs` is accepted in this cycle; any other value aborts startup with `SERVER_CONFIG_INVALID`. See D-11 below for the extension point this reserves. |
| `FFMPEG_PATH` | — | Path to the `ffmpeg` binary. Without this variable, it is resolved via `PATH`. |
| `FFPROBE_PATH` | — | Path to the `ffprobe` binary. Without this variable, it is resolved via `PATH`. |
| `WHISPER_CPP_PATH` | — | Path to the `whisper-cli` binary used to transcribe `aroll` assets during a `montage` job's `transcribe` stage. Without this variable, it is resolved via `PATH`. |
| `WHISPER_MODEL_PATH` | — | Path to the Whisper GGML model file `whisper-cli` loads. Unlike the three binaries above this is a model file, not an executable, and is never resolved via `PATH` — it must point at an actual file on disk or `GET /health` reports it unresolved and any `montage` job's `transcribe` stage fails with `503 MEDIA_BINARY_NOT_FOUND`. Never commit an actual path or the model file itself; only the variable name belongs in version control. |

| `PIPER_PATH` | — | Path to the [Piper](https://github.com/OHF-Voice/piper1-gpl) TTS executable used by a `voice` job's `synthesize` stage. Without this variable it is resolved via `PATH`. Installed outside this repository with `python3 -m pip install --user piper-tts` (the binary lands in `~/Library/Python/3.11/bin/piper` on macOS, like `yt-dlp`). |
| `PIPER_MODEL_PATH` | — | Path to the `.onnx` Piper voice model. Like `WHISPER_MODEL_PATH` this is a model file, not an executable, and is **never** resolved via `PATH`: it must point at a readable file or `GET /health` reports it unresolved and any `voice` job fails with `503 VOICE_MODEL_UNAVAILABLE`. Its **directory** is also the voice catalog served by `GET /voices`, so every `.onnx` next to it becomes selectable. Voices are downloaded from [`rhasspy/piper-voices`](https://huggingface.co/rhasspy/piper-voices); the Rioplatense one used to verify this cycle is `es/es_AR/daniela/high/es_AR-daniela-high.onnx` (114 199 011 bytes, `sha256 7ceb1fc0dab349418c5b54a639ae9ee595212d7c9ea422220d8419163d5cc985`) plus its `.onnx.json` config (7 248 bytes), which must sit next to the model. Never commit a path or the model itself. |
| `PIPER_PREVIEW_CACHE_DIR` | `<OS tmp>/video-maker-voice-previews` | Directory where `GET /voices/:voiceId/preview` caches the demo wav of each installed voice. It sits **outside `media/`** on purpose: a demo clip is not material of any project, and everything under `media/<slug>/` is what the CLI and the producer take inventory of. The cache is rebuilt for a voice whose `.onnx` is newer than the cached wav. |
| `CLAUDE_CLI_PATH` | `claude` | Path to the Claude Code CLI used as the AI agent of a `storyboard` job. Without this variable it is resolved via `PATH`. **No API key is involved**: the CLI authenticates with the subscription already installed on the machine. If it cannot be started, a `storyboard` job fails with `503 AI_AGENT_UNAVAILABLE`. |
| `CLAUDE_CLI_CWD` | the OS temporary directory | Working directory the agent process runs in. The default is deliberately **outside this repository**: from the repo root the CLI would load this project's `CLAUDE.md` and settings and answer as an SDD orchestrator instead of a storyboard writer. Point it somewhere else only if you know why. |
| `CLAUDE_CLI_TIMEOUT_MS` | `600000` (10 min) | Positive integer. Zero, negative or non-numeric makes the `storyboard` job fail with `SERVER_CONFIG_INVALID`. A real call took 70-100 s on this machine. |
| `CLAUDE_CLI_MODEL` | `sonnet` | Model alias passed to the CLI (`sonnet`, `opus`, …). The adapter **never** calls the CLI without `--model`: letting it fall back to the machine's default model is what made a `storyboard` job die in 5-10 s with `API Error: 400 … claude_code_version_too_old` (FIX-e-burgos-008-001). This is the default of the `storyboard` job; the body of `POST /projects/:slug/jobs` overrides it per job with `model`, and the producer has its own `PRODUCER_MODEL`. |
| `PRODUCER_MODEL` | `sonnet` | Default model alias for the **studio producer** (`spec-e-burgos-015`), and the one a project starts on. `sonnet` on cost grounds: a producer turn can run for minutes and call dozens of tools. It **must** belong to `PRODUCER_MODELS` or startup aborts with `SERVER_CONFIG_INVALID`. From the chat the user picks the model per message, so this is a default, not a lock. |
| `PRODUCER_MODELS` | `sonnet,opus,haiku` | Comma separated list of the model aliases the chat may choose from. `GET .../producer` publishes it as `models.allowed` with a label and a description each; `POST .../producer/messages` rejects anything outside it with `422 PRODUCER_MODEL_INVALID`. A list that names no model aborts startup with `SERVER_CONFIG_INVALID`. |
| `PRODUCER_TURN_TIMEOUT_MS` | `1800000` (30 min) | Positive integer. Zero, negative or non-numeric aborts startup with `SERVER_CONFIG_INVALID` (exit 78) instead of falling back to the default. Half an hour because a single turn can include a transcription and a full render. |
| `PRODUCER_SKILL_PATH` | `sdd/skills/video-producer/SKILL.md` | The skill that **is** the producer's system prompt, read from disk on every turn (edit it and the next turn picks it up). Resolved against the process working directory. If it cannot be read, `POST .../producer/messages` answers `503 PRODUCER_UNAVAILABLE`. |
| `RENDER_API_URL` | `http://<RENDER_API_HOST>:<RENDER_API_PORT>` | The URL the producer agent is told to call to enqueue jobs on this same service. Only override it when the service is reachable at a different address from inside the child process. |

**Never commit values for any of the six binary variables above** (or for any other secret in
`.env`) — only their names belong in this file or in any other tracked document.

**The default port (`4310`) can be taken on this machine by the SDD kit's own docs viewer**
(`pnpm sdd:docs`, which runs `sdd/docs/serve.mjs`). If startup fails with `EADDRINUSE`, that is not
a defect of the service: use a different port for manual verification, e.g. `RENDER_API_PORT=4319`
(the smoke script below uses `4399`).

## Exit codes

| Code | Cause |
| --- | --- |
| `0` | Normal shutdown via `SIGINT`/`SIGTERM`, **before any render job has run in the process**. |
| `78` | Invalid configuration (`SERVER_CONFIG_INVALID` — an invalid `RENDER_API_PORT`, `RENDER_API_MAX_UPLOAD_BYTES` or `RENDER_API_OBJECT_STORE`). |
| `1` | Any other startup failure. |

No startup path prints `.stack`; the error goes to stdout/stderr as a single JSON line
(`{"event": "startup-failed", "error": {...}}`).

**See "Known issue: the exit code after a render is not part of the contract" below** — once a
job has rendered, `SIGTERM`/`SIGINT` no longer reliably answer `0`.

## Endpoints

All error responses share the envelope `{ "error": { code, stage, message, resource?, expected?,
hint?, assetPersisted?, catalogUpdated? } }` — optional fields are omitted, never emitted as
`null`. The full `code → HTTP status` mapping (37 codes) lives in
`sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-03/architect.md` §9; it is not duplicated
here to avoid it going stale. `404 ROUTE_NOT_FOUND` and `405 METHOD_NOT_ALLOWED` apply to every
path below and are not repeated per endpoint.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health probe. Reports engine module and media binary resolution (now four binaries: `ffmpeg`, `ffprobe`, `whisperCli`, `whisperModel`), plus `capabilities: { renderPipeline, assetStore, jobQueue, montageQueue, storyboardQueue }`, `cycle` and the queue's `jobs: { running, queued }` counters. Always 200, in both the `ok` and `degraded` states — neither the asset store nor the job queue's load enters the health calculation. The `claude` CLI is deliberately **not** in `binaries`: that list is resolved by `@video-maker/media-local`, and adding it would report `degraded` on every machine without Claude Code installed, CI included. `capabilities.producer` (added by `spec-e-burgos-015` `cycle-01`) is `true` when the Claude Code binary resolves and, for the same reason, **never** turns the service `degraded`. `montageQueue` is always `true`: a `montage` job can always be created, whether or not the four binaries resolve — an unresolved binary only fails the job itself, at the stage that needs it (`503 MEDIA_BINARY_NOT_FOUND`), the same contract `renderPipeline`/`jobQueue` already had. |
| `GET` | `/projects` | Lists every project directory under `RENDER_API_MEDIA_ROOT`, ascending by slug, with its five layout flags (`raw`, `catalog`, `timeline`, `edl`, `out`). A missing media root answers `200 []`; files and non-portable directory names are ignored silently. |
| `POST` | `/projects` | Creates the canonical project layout for a slug: `raw/aroll`, `raw/broll`, `raw/images`, `raw/audio`, `raw/voice`, `raw/logo`, `work`, `out`, in that exact order. Body `{ "slug": "my-project" }`; `content-type` is not required. `409` if the project already exists — the existing project is never touched. |
| `GET` | `/projects/:slug` | Project detail: layout flags plus `assetSource` (`catalog` \| `raw-scan`) and `assetCounts` by role, both derived from the same resolver `GET .../assets` uses, so the two endpoints never disagree. |
| `GET` | `/projects/:slug/assets` | Lists the project's assets. Serves from `work/catalog.json` when it exists and validates (`source: "catalog"`); falls back to a live scan of `raw/**` when it does not exist (`source: "raw-scan"`, `media: null` on every entry, nothing is probed or written). A catalog that exists but is corrupt is a `500 CATALOG_UNREADABLE` — it never falls back to the raw scan silently. |
| `PUT` | `/projects/:slug/assets/:role/:filename` | Uploads a raw asset as a binary body (never multipart). `role` is one of the six roles of the catalog: `aroll`, `broll`, `image`, `audio`, `voice` and `logo` (`spec-e-burgos-015` `cycle-02` added the last one, so the Web Studio can put a brand logo into `raw/logo/` without a terminal; the catalog only admits image extensions there). Headers `content-length` and `content-type` are required. Writes to a temporary file under `work/.uploads/`, promotes it onto `raw/<role-dir>/<filename>` with an atomic rename, probes it, and updates `work/catalog.json` — all in the same request, serialized per project by the server's own `RenderApiRuntime` (no more module-level singleton, `cycle-03` D-23). A destination that already exists is rejected (`409`), never overwritten. A probe failure keeps the uploaded file and records the failure in the catalog instead of discarding the upload. |
| `DELETE` | `/projects/:slug/assets/:role/:filename` | Deletes one raw asset (EP-027, `FIX-e-burgos-005-001`). Same confinement as the upload: the target can never leave `raw/<role-dir>/`. Removes the file, drops its entry from `work/catalog.json` (`assets`, `transcripts`, `ignored`, `probeFailures`) and deletes the transcript file the removed `transcripts[]` entry pointed at — the only derivative the catalog models per asset. Derivatives it does not model (`work/renders/<jobId>/`, `work/edl.json`, files under `out/`) stay orphaned until the next ingest or montage. `404 ASSET_NOT_FOUND` when the file is absent. `409 ASSET_IN_USE` when `work/timeline.json` still references it in `assets[]`, in a clip of any track or as `logo.assetId`; the `hint` lists the uses and `?force=true` deletes anyway, answering `200 { slug, deleted, timelineReferences }` so the caller can warn about what it broke. Serialized per project by the same mutex as the upload, and nothing is removed unless every check passed. |
| `GET` | `/projects/:slug/timeline` | Returns the stored `Timeline` document, parsed and schema-validated. `404 TIMELINE_NOT_FOUND` when absent (never a `null` body); `422 TIMELINE_INVALID` when the stored document does not validate. |
| `PUT` | `/projects/:slug/timeline` | Replaces the stored `Timeline` (full document, not a patch). Validated against the schema before any write — an invalid document never touches the filesystem. Always `200`, whether the file is created or replaced. |
| `GET` | `/projects/:slug/edl` | Same contract as `GET .../timeline`, for the `EditDecisionList` at `work/edl.json`. |
| `PUT` | `/projects/:slug/edl` | Same contract as `PUT .../timeline`, for `work/edl.json`. |
| `GET` | `/projects/:slug/files/*path` | Downloads any artifact under `raw/`, `work/` or `out/` as raw bytes — it never parses the content, even for `timeline.json`/`edl.json` (that is what keeps the "same bytes as the CLI" guarantee, D-16). Supports a single-range `Range` header (`206` satisfiable, `416` unsatisfiable with `content-range: bytes */<size>`); a malformed or multi-range header is ignored and the whole file is served with `200` (RFC 7233 §3.1). A directory answers `404 ARTIFACT_NOT_FOUND` — there is no directory listing. Also serves a render job's deliverable — see "Downloading a job's deliverable" below. |
| `POST` | `/projects/:slug/jobs` | Creates a job. The body is optional, and every field inside it is optional (`{ kind?: 'render' \| 'montage', preset?: string, seed?: number, overwrite?: boolean }`). An absent body, an empty object, or a body that mentions no `kind` at all all mean `kind: 'render'` — **byte-identical to the endpoint's behavior before `cycle-01` of `spec-e-burgos-007-web-montage`** (retro-compatibility contract, see "Montage jobs" below). A syntactically invalid JSON body is new behavior this cycle: it now answers `400 REQUEST_BODY_INVALID_JSON` instead of being silently ignored (no existing client sends a body on this endpoint, so nothing breaks). `202` with header `location: /jobs/<id>` and the full job as body; `state` is `"running"` if the single job slot is free, `"queued"` otherwise. Render-branch errors (unchanged): `422 PROJECT_SLUG_INVALID`, `404 PROJECT_NOT_FOUND`, `404 TIMELINE_NOT_FOUND`, `422 TIMELINE_INVALID`. New errors, montage branch only: `422 JOB_KIND_INVALID`, `422 MONTAGE_PRESET_INVALID`, `422 MONTAGE_SEED_INVALID`, `422 MONTAGE_OVERWRITE_INVALID`, `409 TIMELINE_ALREADY_EXISTS`. |
| `GET` | `/projects/:slug/storyboard` | Returns the stored `StoryboardDocument` from `work/storyboard.json`, parsed and schema-validated. `404 STORYBOARD_NOT_FOUND` when absent; `422 STORYBOARD_INVALID` when the stored document does not validate. Same contract shape as `GET .../timeline`. |
| `PUT` | `/projects/:slug/storyboard` | Replaces the stored `StoryboardDocument` (full document, not a patch). Validated **before** the project is resolved, so an invalid document never touches the filesystem, and written with the same serializer as `timeline.json`/`edl.json`. This is how a hand edit survives: a `storyboard` job refuses to overwrite an existing document without `overwrite: true`. |
| `GET` | `/projects/:slug/storyboard/prompts` | The visual prompts as `text/plain; charset=utf-8` with an explicit `content-length`: the character sheet first, then one block per scene **numbered from `01`** and annotated with its visual source. Scenes that need no external footage are listed too — skipping them would break the numbering the batch import relies on (`01.mp4` → scene 1). |
| `GET` | `/projects/:slug/jobs` | Lists the project's jobs in creation order, each reduced to a summary (`id`, `kind`, `state`, `stage`, `errorCode`, `createdAt`, `startedAt`, `finishedAt`) — never the full `report` or `error`; use `GET /jobs/:jobId` for those. `kind` is the only field this cycle adds; every field that existed before keeps its name and meaning (RNF-2). Does not check that the project exists: a slug with no jobs answers `200 { "slug", "jobs": [] }` whether or not the project does. |
| `GET` | `/jobs/:jobId` | Full job detail, in any of its six states, for either `kind`. Always `200`, even `state: "failed"` — the job's own failure is not a transport error; the typed `error` is embedded in the body instead. `404 RENDER_JOB_NOT_FOUND` for an id the queue does not know. The id is never validated as a path segment: the lookup is a `Map` read, not a filesystem access. |
| `DELETE` | `/jobs/:jobId` | Requests cancellation. See "Cancelling a job" below for the exact status per prior state. |
| `GET` | `/projects/:slug/producer` | The producer conversation of the project (`work/producer/conversation.json`), the Claude Code session behind it and the turn in flight. See "The studio producer" below. |
| `POST` | `/projects/:slug/producer/messages` | Sends a message to the producer and starts a turn **outside the job queue**. Body `{ text, model? }`, with `model` one of `PRODUCER_MODELS`. `202 { slug, turnId, startedAt, status: 'running' }`. `409 PRODUCER_TURN_ACTIVE` with a turn already running on that project, `422 PRODUCER_MODEL_INVALID` for a model outside the list. |
| `GET` | `/projects/:slug/producer/turns/:turnId` | State, accumulated events, answer and suggestions of one turn. |
| `DELETE` | `/projects/:slug/producer/turns/:turnId` | Kills the turn's child process. `202`; poll the turn until `canceled`. |

### Cancelling a job (EP-015)

Cancellation is real but cooperative: nothing is killed, and the response describes what the
server has actually done, not a promise about when the job will stop.

| Prior state | Result | Status | Notes |
| --- | --- | --- | --- |
| `queued` | `canceled` | `200` | Terminal immediately — the job never ran and never invoked a single pipeline port (CA-026). |
| `running` | `canceling` | `202` | Accepted; the binary in flight finishes its current invocation on its own, then the pipeline stops at the next stage checkpoint. No process is signalled. Can take as long as the current stage — minutes, for `render` on a full-length project. |
| `canceling` | `canceling` | `202` | Idempotent repeat of an already-accepted cancellation — not a `409`. |
| `succeeded` / `failed` / `canceled` | — | `409 RENDER_JOB_NOT_CANCELABLE` | The job already finished; its final state never changes. |
| an id the queue does not know | — | `404 RENDER_JOB_NOT_FOUND` | Same code whether the id never existed or the process restarted and the (unpersisted) queue forgot it. |

A job cancelled while its last stage (`verify`) is in flight can still finish successfully on
disk — the entry state wins over the pipeline's own result (D-22), so a `canceled` job's `report`
is `null` even though `out/<jobId>.mp4` may exist and be complete. Nothing is deleted either way.

### Downloading a job's deliverable

There is no dedicated download endpoint for a job. A `succeeded` job's
`report.deliverable.resource` is a project-relative path (`out/<jobId>.mp4`); compose the download
URL with the existing artifact endpoint (EP-011):

```
GET /projects/:slug/files/out/<jobId>.mp4
```

## Montage jobs (`spec-e-burgos-007-web-montage`, `cycle-01`)

A `montage` job takes a project that has no `Timeline` yet and produces one, over the same four
stages `ingestProject`/`autoMontage` already run through the CLI: `discover` (asset discovery
under `raw/`) → `probe` (`ffprobe` on every discovered asset) → `transcribe` (`whisper-cli` on
`aroll` assets) → `plan` (`autoMontage`, no binary involved). Progress is monotonic — a stage
never reports a snapshot behind one already reported, the same rule `render`'s own progress
already followed — and, for `transcribe`, the `percent` is a floor, not a promise: only the
default `aroll` role is transcribed, so a project with other roles can finish `transcribe` without
ever reaching `percent: 100`. The real signal that a stage is done is the `stage` transition
itself, never `percent` reaching 100.

**Request body**, all fields optional:

```ts
interface CreateJobRequestBody {
  readonly kind?: 'render' | 'montage';
  readonly preset?: string;
  readonly seed?: number;
  readonly overwrite?: boolean;
  readonly scriptPath?: string;
  readonly scriptText?: string;
  readonly logo?: 'auto' | 'off';
  readonly voice?: 'aroll' | 'script';
}
```

- `preset` — one of `software-demo` (default), `hardware`, `recipe`, `educational`
  (`@video-maker/auto-montage`'s `MONTAGE_PRESETS`). Anything else answers
  `422 MONTAGE_PRESET_INVALID`.
- `seed` — a non-negative integer, default `0`. Anything else (negative, non-integer, non-number)
  answers `422 MONTAGE_SEED_INVALID`.
- `overwrite` — a boolean, default `false`. Anything else answers `422 MONTAGE_OVERWRITE_INVALID`.
  When `false` and the project already has a persisted `Timeline`, the request is rejected with
  `409 TIMELINE_ALREADY_EXISTS` **before any file is touched and before any job is registered** —
  a manual edit already sitting in `work/timeline.json` is never overwritten by accident. When
  `true`, the existing `Timeline`/EDL/catalog are replaced by the montage's own output once the job
  succeeds.
- `scriptPath` / `scriptText` (spec-014) — the script the voice reads, as a project-relative path
  or inline. **At most one of the two**; sending both, or either as an empty/non-string value,
  answers `422 MONTAGE_SCRIPT_INVALID` before registering the job. With a script, the captions are
  aligned against it: the words whisper misheard get the script's text while keeping whisper's
  timings, the words whisper invented are dropped and the ones it omitted are spread into the
  neighbouring gap. A `scriptPath` that does not resolve to a readable file surfaces as
  `404 MONTAGE_SCRIPT_NOT_FOUND` when the job settles (stage `plan`), not at request time.
- `logo` (spec-014) — `'auto'` (default) or `'off'`. With `'auto'`, if the project has an image in
  `raw/logo/` it becomes the Timeline's logo layer, bottom-right. Anything else answers
  `422 MONTAGE_LOGO_INVALID`.
- `format` (FIX-e-burgos-007-001) — `'reels-9x16'` (default), `'tiktok-9x16'`, `'shorts-9x16'` or
  `'youtube-16x9'`, forwarded to `autoMontage` as `outputPreset` and written into `timeline.format`.
  Anything else answers `422 MONTAGE_FORMAT_INVALID` before registering the job. The default is
  fixed, not derived from the A-roll: deriving it would silently change the output of every project
  already planned, so the caller chooses — the studio producer reads the A-roll resolution and sends
  `format` explicitly (`youtube-16x9` for a landscape screen recording, `reels-9x16` for a vertical
  one).
- `voice` (FIX-e-burgos-007-002) — `'aroll'` (default) or `'script'`, forwarded to `autoMontage`.
  With `'aroll'` the speech comes from the A-roll transcript, exactly as before. With `'script'` it
  comes from the track the `voice` job synthesized (`work/voice/voice.wav` +
  `work/voice/voice.words.json`, described by `work/voice/script-manifest.json`): concepts, B-roll
  and captions are built from those words, the Timeline's `voice` track points at the wav as an
  audio asset of its own, the A-roll audio is ignored altogether, and silence pruning is off (a
  screen recording is continuous and the narration runs over it, so the EDL keeps a single `keep`).
  With a script **without** time marks the montage lasts `min(voice, A-roll)` and a voice longer
  than the A-roll is cut, with the report saying by how much; with a **timed** script
  (FIX-e-burgos-009-002 — `work/voice/script-manifest.json` carries a non-null `requestedStartMs`
  on at least one line) it lasts the **whole A-roll**, the narration ends earlier and the tail stays
  silent, so `truncatedMs` is 0 and the Timeline's `voice` clip is clipped to the wav's own
  duration. Anything else answers `422 MONTAGE_VOICE_INVALID`, and `'script'` without
  `work/voice/voice.wav` answers `409 MONTAGE_VOICE_TRACK_NOT_FOUND`, both before registering the
  job. Note the overload: on a `voice` job the `voice` field is a voice-model id, on a `montage`
  job it is the speech source.
- `preset`/`seed`/`overwrite`/`scriptPath`/`scriptText`/`logo`/`format`/`voice` are only ever read on the
  `montage` branch. A `render` job (explicit
  or implied) never looks at them, even if they are present in the body.

**Job report** (`report`, once `state` is `succeeded`):

```ts
interface MontageJobReport {
  readonly catalogPath: string;      // "work/catalog.json"
  readonly timelinePath: string;     // "work/timeline.json"
  readonly editDecisionListPath: string; // "work/edl.json"
  readonly preset: string;
  readonly seed: number;
  readonly logoAssetId: string | null;       // spec-014
  readonly scriptAlignment: {                // spec-014, null without a script
    readonly replaced: number;
    readonly removed: number;
    readonly inserted: number;
    readonly dropped: number;
    readonly corrected: number;
  } | null;
  readonly voiceSource: 'aroll' | 'script';   // FIX-e-burgos-007-002
  readonly voiceTrack: {                      // FIX-e-burgos-007-002, null with voice: 'aroll'
    readonly assetId: string;                 // "work/voice/voice.wav"
    readonly durationMs: number;
    readonly truncatedMs: number;             // narration that did not fit in the A-roll
  } | null;
}
```

**Error codes this cycle adds:**

| Code | HTTP | Trigger |
| --- | --- | --- |
| `JOB_KIND_INVALID` | `422` | The body has a `kind` field and it is neither `'render'` nor `'montage'`. |
| `MONTAGE_PRESET_INVALID` | `422` | `preset` present, not one of the four preset names. |
| `MONTAGE_SEED_INVALID` | `422` | `seed` present, not a non-negative integer. |
| `MONTAGE_OVERWRITE_INVALID` | `422` | `overwrite` present, not a boolean. |
| `MONTAGE_SCRIPT_INVALID` | `422` | `scriptPath` and `scriptText` both present, or either is not a non-empty string. |
| `MONTAGE_SCRIPT_NOT_FOUND` | `404` | `scriptPath` does not resolve to a readable file in the project (surfaced when the job settles). |
| `MONTAGE_LOGO_INVALID` | `422` | `logo` present, neither `'auto'` nor `'off'`. |
| `MONTAGE_FORMAT_INVALID` | `422` | `format` present, not one of the four output presets. |
| `TIMELINE_ALREADY_EXISTS` | `409` | `overwrite` is `false` (or absent) and `work/timeline.json` already exists. |
| `MONTAGE_RAW_MISSING` | `422` | The project exists but `raw/` has none of the four role directories, or `raw/` itself is unreadable. |
| `MONTAGE_INPUT_INVALID` | `422` | `autoMontage` rejects the ingested catalog (for example: no `aroll` asset after ingest). |
| `MONTAGE_FAILED` | `500` | Anything else `ingestProject`/`autoMontage` throws. |

`MEDIA_BINARY_NOT_FOUND` (`503`, already existed) now also fires from the `probe`/`transcribe`
stages when `ffprobe`/`whisper-cli`/the Whisper model do not resolve.

### Real-process verification (CA-012, CA-013, CA-014)

```bash
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'                 # tiene que salir vacío
vm_stat | awk '/Pages free/ {print $3}'                        # >= 35% de memoria libre, a ojo
npx remotion browser ensure                                     # asegura Chrome headless antes del job de render

MEDIA_TMP="$(mktemp -d)"
mkdir -p "$MEDIA_TMP/smoke-montage/raw"
cp -R media/smoke-ingest/raw/. "$MEDIA_TMP/smoke-montage/raw/"   # SOLO raw/, nunca work/ ni out/
# media/smoke-ingest, media/video-01 y media/video-02 no se tocan en ningún paso de este guion

set -a && source .env && set +a
RENDER_API_PORT=4319 RENDER_API_MEDIA_ROOT="$MEDIA_TMP" SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &
API_PID=$!
sleep 2
BASE="http://127.0.0.1:4319"

curl -s "$BASE/health" | grep -q '"montageQueue":true'
curl -s -X POST "$BASE/projects" -d '{"slug":"smoke-montage"}'    # el layout ya existe via cp; 409 esperable, ignorar

JOB_ID=$(curl -s -X POST "$BASE/projects/smoke-montage/jobs" \
  -H 'content-type: application/json' \
  -d '{"kind":"montage","preset":"software-demo","seed":0}' \
  | node -e "process.stdin.once('data', b => console.log(JSON.parse(b).id))")

until curl -s "$BASE/jobs/$JOB_ID" | grep -q '"state":"succeeded"\|"state":"failed"'; do
  curl -s "$BASE/jobs/$JOB_ID" | node -e "process.stdin.once('data', b => { const j = JSON.parse(b); console.log(j.state, j.progress); })"
  sleep 2
done
curl -s "$BASE/jobs/$JOB_ID" | node -e "process.stdin.once('data', b => console.log(JSON.parse(b).state))"  # succeeded

for f in catalog.json timeline.json edl.json; do
  echo "$f: $(shasum -a 256 "$MEDIA_TMP/smoke-montage/work/$f" | cut -d' ' -f1) \
        vs $(shasum -a 256 "media/smoke-ingest/work/$f" | cut -d' ' -f1)"
done
# las tres líneas tienen que mostrar el MISMO hash en ambos lados (RF-4, RNF-1)

# CA-014 — el oráculo tiene que ser sensible: repetir con seed distinto, y TIENE que fallar
rm -rf "$MEDIA_TMP/smoke-montage/work"
JOB_ID_2=$(curl -s -X POST "$BASE/projects/smoke-montage/jobs" \
  -H 'content-type: application/json' \
  -d '{"kind":"montage","preset":"software-demo","seed":1,"overwrite":true}' \
  | node -e "process.stdin.once('data', b => console.log(JSON.parse(b).id))")
until curl -s "$BASE/jobs/$JOB_ID_2" | grep -q '"state":"succeeded"\|"state":"failed"'; do sleep 2; done
diff "$MEDIA_TMP/smoke-montage/work/timeline.json" media/smoke-ingest/work/timeline.json \
  && echo "FALLO: el oráculo NO es sensible — seed distinto dio el mismo timeline" \
  || echo "OK: seed=1 produce un timeline distinto de seed=0 (oráculo sensible, CA-014)"

# job de render encadenado, sobre el resultado de seed=0 (repetir el POST de seed=0 antes de esto si se corrió CA-014)
RENDER_JOB_ID=$(curl -s -X POST "$BASE/projects/smoke-montage/jobs" -d '{}' \
  | node -e "process.stdin.once('data', b => console.log(JSON.parse(b).id))")
until curl -s "$BASE/jobs/$RENDER_JOB_ID" | grep -q '"state":"succeeded"\|"state":"failed"'; do sleep 2; done
curl -s -o "$MEDIA_TMP/out.mp4" "$BASE/projects/smoke-montage/files/out/$RENDER_JOB_ID.mp4"
ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames,r_frame_rate \
  -of default=noprint_wrappers=1 "$MEDIA_TMP/out.mp4"
# nb_frames y r_frame_rate se comparan contra el stream de video, NUNCA contra format.duration

kill -TERM "$API_PID"; wait "$API_PID"
rm -rf "$MEDIA_TMP"
```

**Run 2026-09-09**, against a `raw/`-only copy of `media/smoke-ingest`'s fixture (never the dev's
own `media/` — a scratch copy of just `raw/`, no `work/`/`out/`), port `4319`. Full literal
evidence — hashes, the per-stage timestamped progress, HTTP bodies, `ffprobe` output — lives in
`sdd/specs/spec-e-burgos-007-web-montage/cycles/cycle-01/artifacts/task-020-smoke-notes.md`; this
is the summary:

- `GET /health` → `capabilities.montageQueue: true`, all four binaries `resolved: true`.
- `tools/render-cli ingest && plan --preset software-demo --seed 0` (the oracle) and the API's own
  `montage` job produce `work/catalog.json`/`work/timeline.json`/`work/edl.json` that are
  **byte-identical for `edl.json`**, and identical for `catalog.json`/`timeline.json` once the two
  wall-clock fields every asset probe stamps (`probedAt`, and the source file's own
  `modifiedAtMs`) are set aside — those two fields are, by construction, never reproducible across
  two different runs or two different copies of the same fixture, on the CLI side same as the API
  side. RF-4/RNF-1 hold.
- Stage sequence observed by polling a fresh project (no reusable catalog): `probe`
  (`processedAssets` `1/4` → `2/4` → `3/4` of 4 assets) → `transcribe` → `plan` → `succeeded`, in
  4.9 s. `discover` was never caught by a poll snapshot — it is set synchronously right before
  `ingestProject` runs and the decorator moves to `probe` on the very first `ffprobe` call, faster
  than one HTTP round trip. A second run against a project whose catalog was already current (the
  `overwrite:true` retry) reused every fingerprint and went straight to `succeeded` in 11 ms — a
  correct floor case, not a bug: no asset needed re-probing.
- CA-014: `seed:1` produced a `timeline.json`/`edl.json` different from `seed:0`, on both the CLI
  oracle and the same comparison repeated with the two fields above stripped. The oracle is
  sensitive to `seed`.
- `409 TIMELINE_ALREADY_EXISTS` on a repeat `POST` without `overwrite` once the project has a
  persisted `Timeline`: no new job appeared in `GET /projects/:slug/jobs` (still exactly 1 entry).
  `overwrite:true` on the same request → `202`.
- Chained `render` job on the montage's output → `succeeded`, `538` frames. `ffprobe` on the video
  stream of the deliverable: `codec_name=h264`, `1080x1920`, `r_frame_rate=30/1`, `nb_frames=538`
  — never against `format.duration` (same caveat as CA-033 below: it includes AAC priming padding
  and measures more than the video stream has).
- Shutdown: `SIGTERM` after a job ran in the process. The exact exit code could not be captured
  this run (the backgrounding shell and the one that sent the signal were two separate tool
  invocations, so `wait` had no child to attach to) — the process was confirmed dead via `ps`
  immediately after. See "Known issue" below: once a render has run, `SIGTERM` is already
  documented (CA-033) to answer `exit=143`, not `0`.
- `media/` (the dev's own fixture) was never written to — only the three scratch copies were.

## Storyboard jobs (`spec-e-burgos-008-ai-storyboard`, `cycle-01`)

A third `kind` in the **same** queue turns an idea, or an already written script, into
`work/storyboard.json`: the document that governs the generative mode of the studio. The AI is not
a service and not an SDK — it is **a local binary invoked through the same injectable
`CommandRunner`** the engine uses for `ffmpeg`, `ffprobe` and `whisper-cli`. There is **no API
key**: `claude -p` authenticates with the subscription installed on the machine.

```bash
# an idea to turn into a storyboard
curl -sS -X POST http://127.0.0.1:4401/projects/my-project/jobs \
  -H 'content-type: application/json' \
  -d '{"kind":"storyboard","brief":"A 40s vertical video about the three costliest Nx monorepo traps."}'

# an already written script to split into scenes, replacing an existing storyboard
curl -sS -X POST http://127.0.0.1:4401/projects/my-project/jobs \
  -H 'content-type: application/json' \
  -d '{"kind":"storyboard","scriptText":"Hola, soy Esteban. Hoy te muestro...","overwrite":true}'
```

**Exactly one of `brief` or `scriptText`.** Neither, both, or a blank string is
`422 STORYBOARD_INPUT_INVALID`, evaluated **before** any job is registered. `overwrite` defaults to
`false`; without it, a project that already has `work/storyboard.json` answers
`409 STORYBOARD_ALREADY_EXISTS` and no job appears in the listing. The storyboard is the one thing
the user edits by hand (`PUT .../storyboard`): regenerating it silently would throw that work away.

**Stages** (`GET /jobs/:jobId → progress`, monotonic, same mechanism as the other two kinds):

| Stage | What runs | Percent |
| --- | --- | --- |
| `collect` | Project inventory: catalog assets (role, kind, duration), the A-roll transcript if one exists, and the previous storyboard if one exists. All three go into the prompt. | 33 |
| `propose` | One `claude -p` call. This is the slow stage: 70-100 s on this machine. | 66 |
| `persist` | The proposal is re-validated against `StoryboardProposalSchema`, ids and 1-based indexes are assigned by the service (never by the model), and the document is written. | 100 |

Cancellation is cooperative and identical to the other kinds: checkpoints sit **between** stages,
never inside the agent call.

**How the agent is invoked** (`src/ai/claude-cli-ai-agent.ts`): `--print <userPrompt>
--system-prompt <systemPrompt> --output-format json --json-schema <derived schema> --tools ""
--permission-mode dontAsk --disable-slash-commands`, in `CLAUDE_CLI_CWD`. `--tools ""` disables
every tool, so the subprocess cannot read or write anything: it is a text-to-JSON transformer, not
an agent. The neutral `cwd` keeps it from loading this repo's `CLAUDE.md`. `dontAsk` keeps a
permission prompt from hanging the job until the timeout.

> **The JSON Schema must not declare `$schema`.** Measured on `claude` 2.1.123: with a
> `"$schema"` key present, `--json-schema` is **ignored in silence** — the response comes back
> `is_error: false`, `subtype: "success"` and **without `structured_output`**, carrying prose in
> `result`. `storyboardProposalJsonSchema()` strips `$schema` and `$id` for that reason, and a test
> holds the line.

**Typed errors** (never leak `stderr` or `.stack`):

`AI_AGENT_FAILED` carries what the provider said: `subtype` and `result` from the CLI payload,
each trimmed to 600 characters (`AI_AGENT_DETAIL_MAX_CHARS`), so the caller — the studio producer
included — reports the real cause instead of guessing. `result` is written by the provider and may
name absolute paths of this machine; that is a deliberate trade for a self-hosted studio
(FIX-e-burgos-008-001). A `result` mentioning `claude_code_version_too_old` gets the specific hint
`update Claude Code: run \`claude update\``; a quota marker still wins and maps to
`AI_AGENT_RATE_LIMITED` before any of this.

| Code | HTTP | When |
| --- | --- | --- |
| `AI_AGENT_UNAVAILABLE` | 503 | The CLI could not be started. Install it, sign it in, or set `CLAUDE_CLI_PATH`. |
| `AI_AGENT_RATE_LIMITED` | 429 | The account plan limit was reached. Wait for the window to reset. |
| `AI_AGENT_FAILED` | 502 | The CLI ran but did not complete the request. Carries `subtype` and `result` from the provider, and a `hint` that names `claude update` when the CLI is too old. |
| `AI_AGENT_INVALID_OUTPUT` | 502 | The answer had no `structured_output`, or it did not pass `StoryboardProposalSchema`. |
| `STORYBOARD_INPUT_INVALID` | 422 | `brief`/`scriptText`: neither, both, or not a non-empty string. |
| `STORYBOARD_OVERWRITE_INVALID` | 422 | `overwrite` is not a boolean. |
| `STORYBOARD_ALREADY_EXISTS` | 409 | A storyboard exists and `overwrite` is not `true`. |
| `JOB_MODEL_INVALID` | 422 | `model` is not one of `PRODUCER_MODELS`. |

**Choosing the model per job** (FIX-e-burgos-008-001): `POST /projects/:slug/jobs` takes an
optional `model` on the `storyboard` and `voice` kinds, validated against the same `PRODUCER_MODELS`
list the chat picker uses (`422 JOB_MODEL_INVALID`, no job registered). The `storyboard` job passes
it to `--model`; the `voice` job accepts it for uniformity — the producer sends the model of the
turn on every `POST /jobs` — but synthesis is local and ignores it.
| `STORYBOARD_NOT_FOUND` | 404 | `GET`/`prompts` on a project with no storyboard. |
| `STORYBOARD_INVALID` | 422 | The document does not pass `StoryboardDocumentSchema`. |

### Real-process verification — the storyboard job (CA-013, CA-014, CA-015)

Copy-paste. It calls the real `claude` binary and spends real subscription quota.

```bash
# 0. preconditions
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'   # must print nothing

# 1. a temporary media root: never verify against media/ itself
SMOKE=$(mktemp -d)
cp -R media/smoke-ingest "$SMOKE/smoke-ingest"
rm -f "$SMOKE/smoke-ingest/work/storyboard.json"

# 2. the binary, with the root .env loaded and SWC_NODE_PROJECT set
set -a && source .env && set +a
SWC_NODE_PROJECT=tsconfig.base.json \
RENDER_API_MEDIA_ROOT="$SMOKE" RENDER_API_PORT=4401 CLAUDE_CLI_MODEL=sonnet \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &

# 3. VERIFY YOU ARE TALKING TO YOUR OWN BUILD, not to a leftover server on that port.
#    A stale render-api from another cycle answers 200 to /health and the smoke goes on lying.
curl -sS --retry 30 --retry-delay 1 --retry-all-errors http://127.0.0.1:4401/health \
  | grep -q '"storyboardQueue":true' && echo "own build OK" || echo "WRONG SERVER — change the port"

# 4. the job, from a brief
JOB=$(curl -sS -X POST http://127.0.0.1:4401/projects/smoke-ingest/jobs \
  -H 'content-type: application/json' \
  -d '{"kind":"storyboard","brief":"Un video vertical de 40 segundos sobre las tres trampas mas caras de un monorepo Nx con pnpm."}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

until curl -sS "http://127.0.0.1:4401/jobs/$JOB" \
  | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin)["state"] in ("succeeded","failed","canceled") else 1)'; do sleep 3; done
curl -sS "http://127.0.0.1:4401/jobs/$JOB"

# 5. the document and the numbered prompt sheet
curl -sS http://127.0.0.1:4401/projects/smoke-ingest/storyboard
curl -sS -D - http://127.0.0.1:4401/projects/smoke-ingest/storyboard/prompts

# 6. the guard, then the script branch
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:4401/projects/smoke-ingest/jobs \
  -H 'content-type: application/json' -d '{"kind":"storyboard","brief":"otra idea"}'   # 409
curl -sS -X POST http://127.0.0.1:4401/projects/smoke-ingest/jobs \
  -H 'content-type: application/json' \
  -d '{"kind":"storyboard","scriptText":"Hola. Hoy vemos tres trampas.","overwrite":true}'
```

A `429` is a legitimate outcome, not a defect: the subscription is shared with whatever else is
running on the machine. Record it and retry when the window resets.

Evidence of the executed run, with the literal prompt and the literal CLI response:
`sdd/specs/spec-e-burgos-008-ai-storyboard/cycles/cycle-01/artifacts/`.

## Voice jobs (`spec-e-burgos-009-voice-over`, `cycle-01`)

In the generative mode nobody spoke to camera, so the voice is the clock of the video: the real
duration of every scene comes from its audio, not from the `estimatedDurationMs` the model
proposed. A `voice` job turns the `narration` of each scene of `work/storyboard.json` into one wav
and aligns it word by word with the same Whisper the ingest uses.

```bash
# every scene, with the voice configured in PIPER_MODEL_PATH
curl -sS -X POST http://127.0.0.1:4310/projects/<slug>/jobs \
  -H 'content-type: application/json' -d '{"kind":"voice"}'

# only two scenes, with an explicit voice, replacing what is already there
curl -sS -X POST http://127.0.0.1:4310/projects/<slug>/jobs \
  -H 'content-type: application/json' \
  -d '{"kind":"voice","voice":"es_AR-daniela-high","sceneIds":["scene-02","scene-04"],"overwrite":true}'

curl -sS http://127.0.0.1:4310/voices                      # what is installed, with label/language/quality
curl -sS http://127.0.0.1:4310/projects/<slug>/voice       # the manifest + staleness per scene

# hear a voice before spending a narration on it (EP-026): first call synthesizes and caches,
# the next ones are served from PIPER_PREVIEW_CACHE_DIR, outside media/
curl -sS -o /tmp/daniela.wav -D - http://127.0.0.1:4310/voices/es_AR-daniela-high/preview
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 /tmp/daniela.wav
```

What lands in `work/voice/`:

| Path | What it is |
| --- | --- |
| `scene-NN.wav` | The deliverable: mono `pcm_s16le` at 48 kHz, the sample rate `mixTimelineAudio` expects. This is the file the Timeline points at. |
| `scene-NN.words.json` | A `Transcription` document, the same shape the ingest writes under `work/transcripts/`, so `spec-012` can drive the captions from it. |
| `manifest.json` | A `VoiceManifest`: per scene the file, the real `durationMs` measured with `ffprobe`, the `sampleRate`, the voice used, a `narrationHash` and `source`. |
| `sources/scene-NN.txt` · `sources/scene-NN.wav` | The narration collapsed to a single line (Piper treats every line of the input file as a separate utterance) and Piper's raw 22 050 Hz output. |
| `whisper/scene-NN.wav` · `whisper/scene-NN.json` | The 16 kHz mono input `whisper-cli` requires, and its own output. |

### Synthesizing a loose script, with no storyboard (FIX-e-burgos-009-001)

The same job takes a script instead of the storyboard: `scriptText` inline, or `scriptPath`
project-relative. **One sentence per line** — Piper treats every line of its input as a separate
utterance, and that is what gives the montage its cut points.

```bash
curl -sS -X POST http://127.0.0.1:4310/projects/<slug>/jobs \
  -H 'content-type: application/json' \
  -d '{"kind":"voice","scriptPath":"work/producer/script.txt"}'

# inline, with a different pause between sentences and replacing the previous take
curl -sS -X POST http://127.0.0.1:4310/projects/<slug>/jobs \
  -H 'content-type: application/json' \
  -d '{"kind":"voice","scriptText":"Primera frase.\nSegunda frase.","gapMs":400,"overwrite":true}'
```

One wav per sentence goes to `sources/line-NN.wav`, they are concatenated with `gapMs` of silence
between them (default `900`, the same pause `plan` cuts on) into **`work/voice/voice.wav`** at
48 kHz mono, Whisper aligns that track into `work/voice/voice.words.json`, and
`work/voice/script-manifest.json` describes it: `source: 'script'`, the voice, the language derived
from the Piper model id, the gap, the measured duration and one entry per line with its `startMs`.
The duration is exactly the sum of the sentences plus `(lines - 1) * gapMs`.

#### Timed scripts (FIX-e-burgos-009-002)

A script line may open with a time mark — `[m:ss]`, `[mm:ss]` or `[m:ss-m:ss]` (the range separator
accepts `-`, `–` and `—`) — and the sentence is then **placed at that time** instead of being
chained, with real silence in between:

```text
[0:00] Entramos a la plataforma con nuestro usuario.
[0:20] Las campañas viven acá.
[1:30-1:37] La campaña nace en borrador.
```

Marked and unmarked lines can be mixed: an unmarked line still chains with `gapMs` after the
previous one. **A script with no mark at all behaves exactly as before.** With marks the track is
built with one `adelay` per segment plus a non-normalizing `amix`, so the gaps are silence and the
sample rate, channel count and Whisper alignment are unchanged.

When a sentence does not fit its window — the window ends at the next mark, or at the end of its own
range — three remedies run **in order**, and the result is reported per line:

1. **Shorten the pause.** The window reserves a `gapMs` cushion before the next sentence; if the
   line fits without it, the cushion is dropped and nothing else changes.
2. **Speed the synthesis up.** The line is re-synthesized with Piper's `--length-scale`, down to
   **`0.85` — a 15 % limit**, below which the voice stops sounding natural. The value used is stored
   as `lengthScale`.
3. **Displace the next line.** If it still does not fit, the sentence is emitted whole, `overflowMs`
   holds the milliseconds that did not fit, and the next line starts at the end of this one instead
   of at its mark (visible as `startMs !== requestedStartMs`).

`lines[]` therefore carries `startMs`, `durationMs`, `endMs`, `requestedStartMs` (`null` without a
mark), `overflowMs` and the optional `lengthScale`. The four new fields are **optional in the
schema**, so a manifest written before this fix still reads; `schemaVersion` stays at `1`.

When the last line declares a range (`[1:30-1:37]`) and the narration ends before it, the track is
padded with silence up to that end, so a timed script produces a wav that lasts what the script says
it lasts. A montage over that track reports `voiceTrack.truncatedMs` against the end of the **last
sentence**, never against the padding.

The storyboard manifest is **not** touched: script mode writes its own document, and the job report
tells the two apart — `source`, `storyboardId: null` and a `track` object instead of `scenes`.
Rejections (all before the job is registered): `422 VOICE_SCRIPT_INVALID` for `scriptText` and
`scriptPath` together, an empty one of either, `sceneIds` alongside a script, or a `gapMs` that is
not a non-negative integer or comes without a script; `409 VOICE_ALREADY_EXISTS` when
`work/voice/voice.wav` is there without `overwrite: true`. A `scriptPath` that cannot be read
surfaces as `404 VOICE_SCRIPT_NOT_FOUND` when the job settles (stage `synthesize`).

Rules worth knowing before calling it:

- **The storyboard must exist — in storyboard mode.** With `scriptText`/`scriptPath` it is never
  read. No `work/storyboard.json` is `404 STORYBOARD_NOT_FOUND`, checked
  before the job is registered — as are an unknown `sceneIds` entry (`404 VOICE_SCENE_NOT_FOUND`)
  and a scene that already has a track without `overwrite: true` (`409 VOICE_ALREADY_EXISTS`).
- **An uploaded locution always wins.** A track with `source: 'uploaded'` is skipped by every
  `voice` job, `overwrite` included. To go back to a synthesized take, remove that entry first.
- **`narrationHash` is change detection, not a checksum.** `GET /projects/<slug>/voice` reports
  `stale: true` for a scene whose narration was edited after its track was produced, `null` for a
  track whose scene no longer exists.
- **Stages are `synthesize | transcribe | persist`** with a per-scene counter, monotonic, and
  cancellation is cooperative between scenes: `manifest.json` is written once, at the end, so a
  canceled or failed job never leaves a half-written manifest.

### Attaching your own locution (EP-021)

```bash
# 1. upload the take with the voice role (EP-006) — it lands in raw/voice/
curl -sS -X PUT --data-binary @take-02.wav \
  -H 'content-type: audio/wav' \
  http://127.0.0.1:4310/projects/<slug>/assets/voice/take-02.wav

# 2. name it for a scene: it is normalized and transcribed exactly like a synthesized track
curl -sS -X PUT http://127.0.0.1:4310/projects/<slug>/voice/scenes/scene-02 \
  -H 'content-type: application/json' -d '{"fileName":"take-02.wav"}'
```

The call is synchronous and runs `ffmpeg` and `whisper-cli` inline, so a long take holds the
connection open. Making it a fourth job kind is a decision left to a future cycle.

### Real-process verification — the voice job (CA-001, CA-002, CA-003, CA-005)

Copy-paste. It calls the real `piper` and `whisper-cli`.

```bash
# 0. preconditions: no heavy process alive, >= 35% memory free
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless|piper'   # must print nothing
memory_pressure | tail -1

# 1. a temporary media root seeded with a REAL storyboard: never verify against media/ itself
SMOKE=$(mktemp -d)
mkdir -p "$SMOKE/voice-smoke/work"
cp -R media/smoke-ingest/raw "$SMOKE/voice-smoke/raw"
mkdir -p "$SMOKE/voice-smoke/raw/voice" "$SMOKE/voice-smoke/out"
cp sdd/specs/spec-e-burgos-008-ai-storyboard/cycles/cycle-02/artifacts/smoke-storyboard-from-web.json \
   "$SMOKE/voice-smoke/work/storyboard.json"

# 2. the binary, with the root .env loaded and SWC_NODE_PROJECT set
set -a && source .env && set +a
SWC_NODE_PROJECT=tsconfig.base.json \
RENDER_API_MEDIA_ROOT="$SMOKE" RENDER_API_PORT=4411 \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &

# 3. VERIFY YOU ARE TALKING TO YOUR OWN BUILD. Port 4399 already holds a render-api from spec-007
#    on this machine, and a stale server answers 200 to /health while lying about everything else.
curl -sS --retry 30 --retry-delay 1 --retry-all-errors http://127.0.0.1:4411/health \
  | grep -q '"voiceQueue":true' && echo "own build OK" || echo "WRONG SERVER — change the port"

curl -sS http://127.0.0.1:4411/voices

# 4. the job over every scene
JOB=$(curl -sS -X POST http://127.0.0.1:4411/projects/voice-smoke/jobs \
  -H 'content-type: application/json' -d '{"kind":"voice"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
until curl -sS "http://127.0.0.1:4411/jobs/$JOB" \
  | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin)["state"] in ("succeeded","failed","canceled") else 1)'; do sleep 3; done
curl -sS "http://127.0.0.1:4411/jobs/$JOB"

# 5. the audio is real: duration > 0 and the sample rate the mix expects
for f in "$SMOKE"/voice-smoke/work/voice/scene-*.wav; do
  ffprobe -v error -show_entries stream=codec_name,sample_rate,channels \
          -show_entries format=duration -of default=noprint_wrappers=1 "$f"
done

# 6. the words carry timings, and the manifest agrees with the files on disk
python3 -c "
import json,glob,os
for p in sorted(glob.glob('$SMOKE/voice-smoke/work/voice/scene-*.words.json')):
    d=json.load(open(p)); print(os.path.basename(p), len(d['words']), d['words'][0], d['words'][-1])
"
curl -sS http://127.0.0.1:4411/projects/voice-smoke/voice

# 7. partial regeneration: only that scene is touched
curl -sS -X POST http://127.0.0.1:4411/projects/voice-smoke/jobs \
  -H 'content-type: application/json' \
  -d '{"kind":"voice","sceneIds":["scene-02"],"overwrite":true}'

# 8. the uploaded branch: a take under raw/voice wins over the synthesized one
curl -sS -X PUT http://127.0.0.1:4411/projects/voice-smoke/voice/scenes/scene-03 \
  -H 'content-type: application/json' -d '{"fileName":"take-03.wav"}'
```

Evidence of the executed run:
`sdd/specs/spec-e-burgos-009-voice-over/cycles/cycle-01/artifacts/`.

## The studio producer (`spec-e-burgos-015-studio-producer`, `cycle-01`)

The producer is the skill `sdd/skills/video-producer/SKILL.md` running as a **headless Claude Code
process** on the machine's own subscription (no API key, same as the `storyboard` agent). The user
writes a prompt, the agent inventories `raw/`, agrees on a plan and produces the video with the
tools that already exist — enqueuing `montage` and `render` jobs on this very service.

**The turn is not a job (D-1).** The queue has concurrency 1, and the agent waits for the jobs it
enqueues: a turn inside the queue would deadlock itself. Turns live in their own registry with two
differences from the queue:

- Exclusion is **per project**, not global: two projects can have a producer turn at once.
- Cancellation **kills the child process** (`SIGTERM`, then `SIGKILL` after 5 s). There is no
  cooperative checkpoint: the agent is an opaque external process. That is why `DELETE` answers
  `202` and the turn settles when the process actually dies.

The registry is in memory: a turn from a previous run of the service is a `404`. The
**conversation** is not — it lives on disk:

```
media/<slug>/work/producer/
  conversation.json        machine readable: [{ id, role, text, createdAt, suggestions?, turnId? }]
  conversation.md          the same conversation as bullets, the format used by hand in demo-01
  session.json             { sessionId, model, createdAt, lastTurnAt } — the Claude Code session
  turns/<turnId>.jsonl     the raw stream-json of that turn, one event per line
```

`session.json` is what makes the second turn remember the first: turn 1 runs with `--session-id`
and turn 2 with `--resume`, so the app never replays the conversation into the prompt. The stored
id is the one the CLI reports in its `init` event, not the uuid we passed it.

**What the child process is allowed to do.** `--permission-mode dontAsk` plus a whitelist:
`Bash(pnpm nx run render-cli:*)`, `Bash(ffmpeg *)`, `Bash(ffprobe *)`, `Bash(curl *)`,
`Bash(ls *)`, `Bash(cat *)`, `Bash(rtk curl *)`, `Bash(rtk ls *)`, `Bash(rtk read *)`, `Read`,
`Glob`, `Grep`, `Write`, `Edit`, and — since FIX-e-burgos-015-002 — `Bash(<resolved PIPER_PATH> *)`
when the Piper binary resolves on this machine (with `PIPER_PATH=piper` the rule is `Bash(piper *)`;
with no Piper the entry is simply absent). The list is therefore built per turn
(`producerAllowedTools(piperPath)`) and travels in `ProducerTurnStart.allowedTools`. Everything else
is denied by the CLI itself. `--allowedTools` is **variadic and goes last**, one pattern per argument, or it
swallows the flags after it. The working directory is the **repository root** (that is what
`pnpm nx` needs) and `--add-dir` opens the project directory.

> **Two things `--allowedTools` cannot do**, both measured against the real CLI (2.1.123) and not
> guessed:
>
> 1. **A path pattern does not confine a write.** `--allowedTools 'Write(allowed/**)'` denied a
>    write the agent made with an **absolute** path inside `allowed/`. Write confinement is
>    therefore by instruction in the system prompt plus `--add-dir`, never by pattern — which is
>    why plain `Write` is on the list.
> 2. **The repo's rtk hook rewrites the command before the allowlist sees it.** The child runs
>    with the repository as its working directory, so `.claude/settings.json`'s `PreToolUse` hook
>    applies: `curl …` becomes `rtk curl …`, `cat X` becomes `rtk read X`, `ls -la` becomes
>    `rtk ls -la` (`ffprobe`, `ffmpeg` and `pnpm nx` pass through untouched). The rewritten command
>    no longer matches `Bash(curl *)` and is denied — which is why the three `Bash(rtk …)` patterns
>    are on the list. They stay harmless with rtk disabled, and adding a bare `Bash(rtk *)` instead
>    would silently authorize everything rtk wraps, `git` included.
> 3. **A wildcard never authorizes `mkdir`, `cp`, `mv` or `rm`** — but it does authorize an
>    ordinary binary that writes files. Probed for FIX-e-burgos-015-002 against the same CLI:
>    with `--allowedTools "Bash(<PIPER_PATH> *)" Read`, `--permission-mode dontAsk` and
>    `--add-dir <tmp>`, the agent ran Piper and produced a 109 612-byte wav
>    (`pcm_s16le, 22 050 Hz, mono, 2.484535 s`), answering `DONE` with `is_error: false`. So Piper
>    is on the list and the producer can synthesize by hand; the shell built-ins below are the ones
>    that stay out. With
>    `--allowedTools 'Bash(ls *)' 'Bash(mkdir *)' 'Bash(cp *)'` in the same run, `ls -la` was
>    allowed and `mkdir uno` and `cp /etc/hosts ./hosts.txt` were both denied. `Bash(mkdir *)` and
>    `Bash(cp *)` are dead entries, so they are **not** on the list and the system prompt tells the
>    agent to use `Write` (it creates parent directories) and `ffmpeg -i src -c copy dst` instead.
>    `curl`, `ffmpeg` and `ffprobe` with a wildcard do work, writes included.

**The system prompt** is `--append-system-prompt` with three parts: the skill verbatim, the project
context (slug, absolute roots, `RENDER_API_URL`, the catalog assets or the raw scan, whether a
timeline exists), and the app rules — ignore the repository's developer instructions, never modify
source code, write only under the project, do not `source .env` (the media variables are already in
the child's environment), prefer the API jobs over the CLI, and end **every** answer with a
` ```suggestions ` block holding a JSON array of 2–4 short actions.

FIX-e-burgos-015-002 adds four rules to that third part, all of them things the producer got wrong on
a real project: every `storyboard`/`voice` job it POSTs must carry `"model": "<the model of this
turn>"`, injected as a literal value so the agent cannot drift from the model the user picked; the AI
runs on the **Claude Code subscription** and there is no API key, so it must never tell the user one
is missing; on `AI_AGENT_FAILED` / `AI_AGENT_RATE_LIMITED` it must show the literal `result` of the
error and offer to retry or to switch model; and the output format follows the A-roll
(`youtube-16x9` landscape, `9x16` vertical) sent explicitly as `format`, while voice without a
storyboard is the `voice` job with `scriptPath`/`scriptText`.

**Events.** The turn reads `--output-format stream-json --verbose`, without
`--include-partial-messages` (D-3): the studio polls, so message granularity is enough and partial
chunks would only inflate the `.jsonl`. Each line becomes zero or more events:

| Stream line | Event |
| --- | --- |
| `system` / `init` | `{ type: 'status', status: 'started' }` and the session id |
| `assistant` text block | `{ type: 'text', text }` (a `thinking` block is dropped) |
| `assistant` `tool_use` | `{ type: 'tool', name, summary }` — `summary` is derived from the command: `ffprobe raw/broll/lentes.mp4`, `queued montage job`, `Write work/producer/script.txt` |
| `user` `tool_result` with `is_error` | `{ type: 'status', status: 'tool-failed' }` |
| `result` | closes the turn; its text becomes `assistantMessage` after the suggestions block is cut out |

**Typed failures**: `503 PRODUCER_UNAVAILABLE` (no binary or no skill file — checked *before* the
turn is reserved, so a 503 never leaves a project blocked), `409 PRODUCER_TURN_ACTIVE`,
`429 PRODUCER_RATE_LIMITED` (the subscription limit, detected in the `result` line),
`502 PRODUCER_TURN_FAILED` (timeout or no answer), `404 PRODUCER_TURN_NOT_FOUND`,
`409 PRODUCER_TURN_NOT_CANCELABLE`, `422 PRODUCER_MESSAGE_INVALID`, `422 PRODUCER_MODEL_INVALID`,
`422 PRODUCER_STATE_INVALID`.
None of them carries the child's stderr or a host path.

## D-11 — no MinIO in this cycle

The asset store sits behind a single `ObjectStorage` port (9 operations: `stat`, `listDirectory`,
`ensureDirectory`, `readTextFile`, `writeTextFile`, `openReadStream`, `writeTemporary`,
`promoteTemporary`, `removeTemporary`). `RENDER_API_OBJECT_STORE` already reserves the extension
point — today it accepts only `fs`, and adding an S3-compatible backend later means writing a
`MinioObjectStorage` that implements the same port, wiring it in
`src/deps/node-render-api-dependencies.ts` behind that env var, and nothing else in the codebase
has to change: every handler and every pure store function only ever sees `ObjectStorage`, never
the filesystem directly.

## Known risk: the store is not safe across processes

Concurrent uploads to the **same project, from the same running server process**, are serialized
by slug (`createKeyedSerializer`, now owned per-server by `RenderApiRuntime`), so two `PUT`s never
race each other's read-modify-write cycle on `work/catalog.json`. That serialization is
**in-process only**. If the dev runs `tools/render-cli ingest` on a project while this API is
writing that project's catalog, whichever process writes last wins — the same risk that already
exists between two concurrent CLI runs today, and it is out of scope for this cycle. The render job
queue has the identical shape of risk: concurrency 1 is enforced **within one process**; two
instances of this service against the same `media/` root would each dispatch their own job and
compete for CPU/GPU, which is exactly what the concurrency-1 design intends to avoid.

## Known limits (cycle-03)

- **Concurrency is 1, and intra-process.** The queue dispatches at most one job at a time; a
  second job created while the first is running or canceling stays `queued` until the first
  reaches a terminal state. There is no priority and no reordering: strict FIFO.
- **The queue is in-memory and does not survive a restart** (RNF-12). `createRenderJobQueue` keeps
  no state on disk. A job created before a restart is gone after one — querying its id afterwards
  gets the same `404 RENDER_JOB_NOT_FOUND` an id that never existed would.
- **No cap or purge on job history.** Every job, however old, stays in the process' memory until
  it restarts. A future cap would not change any observable contract: a purged job would fall into
  the same `404` an unknown id already does.

## Real-process verification (CA-017)

The script below is the literal evidence that the service does what its tests claim against the
real filesystem — test doubles prove the logic, this proves the wiring. It needs an already-ingested
project at `media/smoke-ingest/` (run `tools/render-cli ingest` first if it does not exist yet);
if that project is missing, or `ffprobe` does not resolve and the upload step answers `503
MEDIA_BINARY_NOT_FOUND`, this verification cannot be declared passed — record explicitly which
line did not run and why. A CA that is documented but never executed is not verified.

```bash
MEDIA_TMP="$(mktemp -d)"
RENDER_API_PORT=4399 RENDER_API_MEDIA_ROOT="$MEDIA_TMP" SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts &
API_PID=$!
sleep 2
BASE="http://127.0.0.1:4399"

curl -s "$BASE/health" | grep -q '"assetStore":true'
curl -s "$BASE/projects"                                            # 200 []
curl -s -X POST "$BASE/projects" -d '{"slug":"smoke-api"}'          # 201
curl -s -X PUT "$BASE/projects/smoke-api/assets/aroll/clip01.mp4" \
  -H 'content-type: video/mp4' --data-binary @media/smoke-ingest/raw/aroll/clip01.mp4
curl -s "$BASE/projects/smoke-api/assets"                           # source: "catalog"
curl -s -X PUT "$BASE/projects/smoke-api/timeline" \
  --data-binary @media/smoke-ingest/work/timeline.json               # 200
curl -s "$BASE/projects/smoke-api/timeline" > /dev/null              # 200
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' \
  "$BASE/projects/smoke-api/files/raw/aroll/clip01.mp4"              # 200 <size>
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' \
  -H 'Range: bytes=0-999' "$BASE/projects/smoke-api/files/raw/aroll/clip01.mp4"   # 206 1000
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Range: bytes=999999999-' "$BASE/projects/smoke-api/files/raw/aroll/clip01.mp4"  # 416

diff <(node -e "process.stdout.write(require('fs').readFileSync('$MEDIA_TMP/smoke-api/work/timeline.json','utf8'))") \
     media/smoke-ingest/work/timeline.json                           # identical bytes (D-16)

kill -TERM "$API_PID"; wait "$API_PID"; echo "exit=$?"               # exit=0 (no job ran in this process)
rm -rf "$MEDIA_TMP"
```

What it proves, line by line: `capabilities.assetStore: true` · an empty root answers `200 []`
(RN-1) · layout creation (RF-9) · a real binary upload with an atomic rename (CA-011) and a
consistent catalog in the same request (CA-012) · a `Timeline` with **the same bytes** the CLI
produces (CA-014 — the `diff` is the evidence) · full download, `206` and `416` (CA-015) · exit `0`
on `SIGTERM`, because no render ran in this process — see the exit-code caveat below.

## Real-process verification (CA-033) — the render job queue

Run 2026-09-09 against `media/smoke-ingest` on port `4399`, 28 s end to end. The literal,
copyable script lives in
`sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-03/architect.md` §13.2 — it is not
repeated here to avoid it going stale, but two corrections apply to what is written there:

- **The process guard has to be `pgrep -fl 'ffmpeg|whisper-cli|chrome-headless'`**, not
  `pgrep -l 'ffmpeg|whisper-cli|[Cc]hrome'` as written in §13.2: the latter's `[Cc]hrome` matches
  the developer's own browser and aborts the smoke on a false positive — hit on the first run.
- Artifacts land under `cycles/cycle-03/artifacts/` per §13.4; this section documents their
  content, not their location.

This run is the evidence that lets `sdd/fixes.json` mark **`FIX-e-burgos-001-001` as
`validated`** (RF-28): it is the first time in the spec that Remotion's webpack bundle is
exercised end to end, not just imported (D-10).

**`GET /health`:**

```json
{"status":"ok","cycle":3,"engine":[{"name":"media-local","loaded":true},{"name":"composition-remotion/render","loaded":true}],"binaries":[{"name":"ffmpeg","resolved":true},{"name":"ffprobe","resolved":true}],"capabilities":{"renderPipeline":true,"assetStore":true,"jobQueue":true},"jobs":{"running":0,"queued":0}}
```

**Job creation and concurrency 1, against the real process (CA-021, CA-022, CA-026):**

- `POST /projects/smoke-ingest/jobs` → `202`, id `ac9647bb-28cd-42c7-bd1c-8522b7a45d7a`, born
  `running` at `stage: "prepare"`.
- A second `POST` while the first is running → born `queued` (real concurrency 1, not a test
  double).
- `DELETE /jobs/<second-id>` → `200`, `state: "canceled"` — a real cancellation of a queued job.

**Progress and the render itself (CA-023, CA-024, D-10):**

`GET /jobs/:jobId` polling observed `stage` `render` with `renderedFrames`/`percent` climbing
`131/538` (24 %) → `359/538` (66 %) → `538/538` (100 %), then `mix` → `mux` → `verify` →
`state: "succeeded"`. **The Remotion webpack bundle bundles and renders for the first time in this
spec.** The job ran in 22.4 s (`startedAt` `02:41:05.312` → `finishedAt` `02:41:27.737`).

**Deliverable and intermediates (RF-24, D-8 / CA-030):**

- `GET /projects/smoke-ingest/files/out/<jobId>.mp4` (EP-011) → `200`, `2133176` bytes.
- Intermediates conserved under `work/renders/<jobId>/`: `video-muted.mp4` `2415500` bytes,
  `master.wav` `3443278` bytes — nothing is deleted (D-8).

**Duration check, never against `format.duration` (RF-27):**

`ffprobe` on the video stream: `codec_name` `h264`, `1080×1920`, `r_frame_rate` `30/1`,
`nb_frames` `538` → `538 / 30 = 17.9333…` s derived, `frameDelta: 0`, within the `±1` frame
tolerance. `format.duration` is never used (it includes AAC priming padding and measures more than
the video stream actually has). Audio stream: `aac`, `48000` Hz, `2` channels.

**Loudness (D-7):**

Job-reported `report.loudness`: `integratedLufs -17.59`, `truePeakDbtp -4.03`,
`integratedDeltaLu -3.59`, `truePeakDeltaDb -3.03`, `withinTolerance: false`. **This is not a smoke
failure** — D-7 stands: the deliverable is published and the delta is reported, never re-mastered
or retried; the smoke only fails if the `loudness` block is missing entirely. An independent
`loudnorm` measurement over the same deliverable, outside the code path under test, gave
`input_i -17.59`, `input_tp -4.03` — identical to the job's own measurement, which is the evidence
that `verifyMixLoudness` measures correctly and the low integrated loudness is a property of
`media/smoke-ingest`'s source material, not an instrumentation bug.

## Known issue: the exit code after a render is not part of the contract

`SIGTERM` answers `exit=0` for a server that has not run any render job. **Once a job has run to a
terminal state in the process, the same `SIGTERM` answers `exit=143`**, in well under a second
(46 ms observed — not a hang). Isolated by direct observation of the real process:

- server started and stopped without running any job → `exit=0`.
- server that ran one job to `succeeded`, then `SIGTERM` → `exit=143`.

**Root cause:** `@remotion/renderer` registers its own process-level signal handlers to close the
headless browser it keeps alive across renders
(`node_modules/@remotion/renderer/dist/browser/BrowserRunner.js:191-196`):

```js
addEventListener(process, 'SIGINT', () => { killProcess(); process.exit(130); });
addEventListener(process, 'SIGTERM', closeProcess);
```

Once at least one render has run, that handler is registered and competes with this service's own
shutdown handler. An explicit `process.exit(0)` after `server.close()` was tried and **still
produced `exit=143`** — it was reverted rather than kept as a change with no effect. The service's
own ordered shutdown is correct: the no-render case above is the proof.

**This cannot be fixed from inside this process** without reaching into a third-party dependency's
internal listeners — not something this service should do. The clean fix is the one already
descoped for a different reason: **run the render in a separate worker process**, which is also
what raising concurrency above 1 would require. Until that exists, **the exit code observed after
a render is not part of this service's contract** — an operator or supervisor must not key restart
logic on it.

## Out of scope this cycle

- **MinIO or S3.** The store stays on the local filesystem (`media/<project-slug>/`), same as
  `tools/render-cli` — see D-11 above for how a future backend would slot in.
- **Concurrency above 1, and workers in separate processes.** The queue dispatches one job at a
  time, in the same process as the HTTP server. Raising it needs a worker process — the same one
  that would also give the API process an exit code independent of Remotion's internal signal
  handlers (see the known issue above).
- **Persistence of the job queue across restarts** (RNF-12). See "Known limits" above.
- **`apps/render-api/eslint.config.mjs` still does not exist.** The harness' `config-protection`
  hook blocks writing or editing any file named `eslint.config.mjs`, regardless of whether it is
  the workspace root or a subproject. The project lints today against the root flat config (same
  path as `tools/render-cli`, which also has no file of its own). The content proposed for when the
  dev decides to add it lives in `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-03/architect.md`
  §15 — it accumulates the corrections from `cycle-01`/`cycle-02` plus one precision for `cycle-03`:
  `randomId` is now the second port that justifies confining `node:crypto` to
  `node-render-api-dependencies.ts`.
