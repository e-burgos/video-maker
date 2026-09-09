# render-api

HTTP service that fronts the media project store and orchestrates the render pipeline: silent
render + mastered audio mix + mux + loudness verification over a project under
`media/<project-slug>/`. Closes `spec-e-burgos-005-render-service`: `cycle-03` adds the render
job queue (`POST`/`GET /projects/:slug/jobs`, `GET`/`DELETE /jobs/:jobId`), per-frame progress and
cooperative cancellation on top of the asset store (`cycle-02`) and the render pipeline
(`cycle-01`, `runRenderPipeline`, now wired to an HTTP route for the first time).

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
| `GET` | `/health` | Service health probe. Reports engine module and media binary resolution, plus `capabilities: { renderPipeline, assetStore, jobQueue }`, `cycle` and the queue's `jobs: { running, queued }` counters. Always 200, in both the `ok` and `degraded` states — neither the asset store nor the job queue's load enters the health calculation. |
| `GET` | `/projects` | Lists every project directory under `RENDER_API_MEDIA_ROOT`, ascending by slug, with its five layout flags (`raw`, `catalog`, `timeline`, `edl`, `out`). A missing media root answers `200 []`; files and non-portable directory names are ignored silently. |
| `POST` | `/projects` | Creates the canonical project layout for a slug: `raw/aroll`, `raw/broll`, `raw/images`, `raw/audio`, `work`, `out`, in that exact order. Body `{ "slug": "my-project" }`; `content-type` is not required. `409` if the project already exists — the existing project is never touched. |
| `GET` | `/projects/:slug` | Project detail: layout flags plus `assetSource` (`catalog` \| `raw-scan`) and `assetCounts` by role, both derived from the same resolver `GET .../assets` uses, so the two endpoints never disagree. |
| `GET` | `/projects/:slug/assets` | Lists the project's assets. Serves from `work/catalog.json` when it exists and validates (`source: "catalog"`); falls back to a live scan of `raw/**` when it does not exist (`source: "raw-scan"`, `media: null` on every entry, nothing is probed or written). A catalog that exists but is corrupt is a `500 CATALOG_UNREADABLE` — it never falls back to the raw scan silently. |
| `PUT` | `/projects/:slug/assets/:role/:filename` | Uploads a raw asset as a binary body (never multipart). Headers `content-length` and `content-type` are required. Writes to a temporary file under `work/.uploads/`, promotes it onto `raw/<role-dir>/<filename>` with an atomic rename, probes it, and updates `work/catalog.json` — all in the same request, serialized per project by the server's own `RenderApiRuntime` (no more module-level singleton, `cycle-03` D-23). A destination that already exists is rejected (`409`), never overwritten. A probe failure keeps the uploaded file and records the failure in the catalog instead of discarding the upload. |
| `GET` | `/projects/:slug/timeline` | Returns the stored `Timeline` document, parsed and schema-validated. `404 TIMELINE_NOT_FOUND` when absent (never a `null` body); `422 TIMELINE_INVALID` when the stored document does not validate. |
| `PUT` | `/projects/:slug/timeline` | Replaces the stored `Timeline` (full document, not a patch). Validated against the schema before any write — an invalid document never touches the filesystem. Always `200`, whether the file is created or replaced. |
| `GET` | `/projects/:slug/edl` | Same contract as `GET .../timeline`, for the `EditDecisionList` at `work/edl.json`. |
| `PUT` | `/projects/:slug/edl` | Same contract as `PUT .../timeline`, for `work/edl.json`. |
| `GET` | `/projects/:slug/files/*path` | Downloads any artifact under `raw/`, `work/` or `out/` as raw bytes — it never parses the content, even for `timeline.json`/`edl.json` (that is what keeps the "same bytes as the CLI" guarantee, D-16). Supports a single-range `Range` header (`206` satisfiable, `416` unsatisfiable with `content-range: bytes */<size>`); a malformed or multi-range header is ignored and the whole file is served with `200` (RFC 7233 §3.1). A directory answers `404 ARTIFACT_NOT_FOUND` — there is no directory listing. Also serves a render job's deliverable — see "Downloading a job's deliverable" below. |
| `POST` | `/projects/:slug/jobs` | Creates a render job. The stored `Timeline` is read, validated and snapshotted **once, at creation** — a job always renders the `Timeline` that existed when it was created, never a later `PUT`. No body — a payload, if sent, is ignored and never parsed (D-19). `202` with header `location: /jobs/<id>` and the full job as body; `state` is `"running"` if the single render slot is free, `"queued"` otherwise. Errors: `422 PROJECT_SLUG_INVALID`, `404 PROJECT_NOT_FOUND`, `404 TIMELINE_NOT_FOUND`, `422 TIMELINE_INVALID` — all four already existed before this cycle. |
| `GET` | `/projects/:slug/jobs` | Lists the project's jobs in creation order, each reduced to a summary (`id`, `state`, `stage`, `errorCode`, `createdAt`, `startedAt`, `finishedAt`) — never the full `report` or `error`; use `GET /jobs/:jobId` for those. Does not check that the project exists: a slug with no jobs answers `200 { "slug", "jobs": [] }` whether or not the project does. |
| `GET` | `/jobs/:jobId` | Full job detail, in any of its six states. Always `200`, even `state: "failed"` — the job's own failure is not a transport error; the typed `error` is embedded in the body instead. `404 RENDER_JOB_NOT_FOUND` for an id the queue does not know. The id is never validated as a path segment: the lookup is a `Map` read, not a filesystem access. |
| `DELETE` | `/jobs/:jobId` | Requests cancellation. See "Cancelling a job" below for the exact status per prior state. |

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
