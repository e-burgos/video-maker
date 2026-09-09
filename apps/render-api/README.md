# render-api

HTTP service that fronts the media project store and orchestrates the render pipeline: silent
render + mastered audio mix + mux + loudness verification over a project under
`media/<project-slug>/`. Closes `cycle-02` of `spec-e-burgos-005-render-service`: adds the asset
store (project layout, asset upload with catalog consistency, Timeline/EDL persistence, artifact
download with byte ranges) on top of the `cycle-01` foundation. `runRenderPipeline` is implemented
and covered by tests, but **still has no HTTP route that triggers it** (arrives in `cycle-03`,
together with the job queue).

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
| `RENDER_API_MEDIA_ROOT` | `media` (resolved against `process.cwd()`) | An absolute value is kept as-is. This is the root the asset store confines every storage operation to (`ASSET_PATH_INVALID` if a resolved path ever escapes it). |
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
| `0` | Normal shutdown via `SIGINT`/`SIGTERM`. |
| `78` | Invalid configuration (`SERVER_CONFIG_INVALID` — an invalid `RENDER_API_PORT`, `RENDER_API_MAX_UPLOAD_BYTES` or `RENDER_API_OBJECT_STORE`). |
| `1` | Any other startup failure. |

No startup path prints `.stack`; the error goes to stdout/stderr as a single JSON line
(`{"event": "startup-failed", "error": {...}}`).

## Endpoints

All error responses share the envelope `{ "error": { code, stage, message, resource?, expected?,
hint?, assetPersisted?, catalogUpdated? } }` — optional fields are omitted, never emitted as
`null`. The full `code → HTTP status` mapping (35 codes) lives in `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-02/architect.md`
§6.1/§6.2; it is not duplicated here to avoid it going stale. `404 ROUTE_NOT_FOUND` and
`405 METHOD_NOT_ALLOWED` apply to every path below and are not repeated per endpoint.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health probe. Reports engine module and media binary resolution, plus `capabilities: { renderPipeline, assetStore, jobQueue }` and `cycle`. Always 200, in both the `ok` and `degraded` states — the asset store never enters the health calculation. |
| `GET` | `/projects` | Lists every project directory under `RENDER_API_MEDIA_ROOT`, ascending by slug, with its five layout flags (`raw`, `catalog`, `timeline`, `edl`, `out`). A missing media root answers `200 []`; files and non-portable directory names are ignored silently. |
| `POST` | `/projects` | Creates the canonical project layout for a slug: `raw/aroll`, `raw/broll`, `raw/images`, `raw/audio`, `work`, `out`, in that exact order. Body `{ "slug": "my-project" }`; `content-type` is not required. `409` if the project already exists — the existing project is never touched. |
| `GET` | `/projects/:slug` | Project detail: layout flags plus `assetSource` (`catalog` \| `raw-scan`) and `assetCounts` by role, both derived from the same resolver `GET .../assets` uses, so the two endpoints never disagree. |
| `GET` | `/projects/:slug/assets` | Lists the project's assets. Serves from `work/catalog.json` when it exists and validates (`source: "catalog"`); falls back to a live scan of `raw/**` when it does not exist (`source: "raw-scan"`, `media: null` on every entry, nothing is probed or written). A catalog that exists but is corrupt is a `500 CATALOG_UNREADABLE` — it never falls back to the raw scan silently. |
| `PUT` | `/projects/:slug/assets/:role/:filename` | Uploads a raw asset as a binary body (never multipart). Headers `content-length` and `content-type` are required. Writes to a temporary file under `work/.uploads/`, promotes it onto `raw/<role-dir>/<filename>` with an atomic rename, probes it, and updates `work/catalog.json` — all in the same request. A destination that already exists is rejected (`409`), never overwritten. A probe failure keeps the uploaded file and records the failure in the catalog instead of discarding the upload. |
| `GET` | `/projects/:slug/timeline` | Returns the stored `Timeline` document, parsed and schema-validated. `404 TIMELINE_NOT_FOUND` when absent (never a `null` body); `422 TIMELINE_INVALID` when the stored document does not validate. |
| `PUT` | `/projects/:slug/timeline` | Replaces the stored `Timeline` (full document, not a patch). Validated against the schema before any write — an invalid document never touches the filesystem. Always `200`, whether the file is created or replaced. |
| `GET` | `/projects/:slug/edl` | Same contract as `GET .../timeline`, for the `EditDecisionList` at `work/edl.json`. |
| `PUT` | `/projects/:slug/edl` | Same contract as `PUT .../timeline`, for `work/edl.json`. |
| `GET` | `/projects/:slug/files/*path` | Downloads any artifact under `raw/`, `work/` or `out/` as raw bytes — it never parses the content, even for `timeline.json`/`edl.json` (that is what keeps the "same bytes as the CLI" guarantee, D-16). Supports a single-range `Range` header (`206` satisfiable, `416` unsatisfiable with `content-range: bytes */<size>`); a malformed or multi-range header is ignored and the whole file is served with `200` (RFC 7233 §3.1). A directory answers `404 ARTIFACT_NOT_FOUND` — there is no directory listing. |

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
by slug (`createKeyedSerializer`), so two `PUT`s never race each other's read-modify-write cycle on
`work/catalog.json`. That serialization is **in-process only**. If the dev runs `tools/render-cli
ingest` on a project while this API is writing that project's catalog, whichever process writes
last wins — the same risk that already exists between two concurrent CLI runs today, and it is out
of scope for this cycle.

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

kill -TERM "$API_PID"; wait "$API_PID"; echo "exit=$?"               # exit=0
rm -rf "$MEDIA_TMP"
```

What it proves, line by line: `capabilities.assetStore: true` · an empty root answers `200 []`
(RN-1) · layout creation (RF-9) · a real binary upload with an atomic rename (CA-011) and a
consistent catalog in the same request (CA-012) · a `Timeline` with **the same bytes** the CLI
produces (CA-014 — the `diff` is the evidence) · full download, `206` and `416` (CA-015) · exit `0`
on `SIGTERM`.

## Out of scope this cycle (cycle-03)

- **No route triggers `runRenderPipeline` yet.** The function exists and is covered by tests;
  wiring it to an HTTP route, with a job queue and progress reporting, is `cycle-03`.
- **No job queue, no progress, no cancellation.**
- **No MinIO or S3 client.** The store stays on the local filesystem
  (`media/<project-slug>/`), same as `tools/render-cli` — see D-11 above for how a future backend
  would slot in.
- **The Remotion webpack bundle is not verified in this cycle.** `GET /health` proves that
  `@video-maker/composition-remotion/render` imports and exposes its symbols
  (`engine[].loaded`), not that `bundleProject`/`renderMedia` run. Exercised by the `cycle-03` E2E
  smoke test.
- **`apps/render-api/eslint.config.mjs` still does not exist.** The harness' `config-protection`
  hook blocks writing or editing any file named `eslint.config.mjs`, regardless of whether it is
  the workspace root or a subproject. The project lints today against the root flat config (same
  path as `tools/render-cli`, which also has no file of its own). The content proposed for when the
  dev decides to add it lives in `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-02/architect.md`
  §14 — it accumulates two corrections on top of `cycle-01` §8.2: `node-render-api-dependencies.spec.ts`
  needs to join the `node:fs` exception (it exercises `ensureDirectory` against a real temporary
  directory) and `node:crypto` joins the restricted import group (the adaptor's `randomUUID()` is
  the only place allowed to generate the temporary upload's file name).
