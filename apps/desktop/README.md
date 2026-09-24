# desktop

The studio packaged as an unsigned macOS app for Apple Silicon, to share with friends.

## Build the installer

```bash
pnpm desktop:dist
```

Leaves `dist/desktop/Video-Maker-<version>-arm64.dmg` (about 254 MB; the installed app is about 775 MB).
It runs, in order: the vendor script (`scripts/vendor-binaries.mjs`, skipped when up to date), the web build,
the JavaScript bundles of `render-api`, the studio MCP server and the Remotion composition, the desktop build,
a flattened staging of the runtime `node_modules` (better-sqlite3 rebuilt for Electron 44), and electron-builder.

## Develop

```bash
pnpm nx run desktop:serve
```

Runs Electron against the repo's `render-api` in development mode and the vendored binaries.
`VIDEO_MAKER_USER_DATA=<dir>` isolates the user data; `DESKTOP_REMOTE_DEBUG_PORT=<port>` enables CDP.
Never launch Electron from a shell that has `ELECTRON_RUN_AS_NODE=1`: it starts as plain Node and exits.

## What the app does

- First run (`src/setup/`): downloads the whisper model, the three sherpa-onnx voices and the Remotion
  browser listed in `vendor/manifest.json`, resumable and verified by size and sha256; lets the user pick the
  projects folder; checks the user's own `claude` CLI (found through the login shell PATH).
- Starts `render-api` with Electron as Node in its own process group, on a stable port in 42000–42999, with an
  allowlisted environment and a per-launch token; kills the whole group on quit, and render-api kills itself if
  the app dies. A stale run is cleaned on the next launch.
- The window loads the web studio served by `render-api` under the token cookie.

## Third-party software

`vendor/THIRD_PARTY_NOTICES.md` lists every bundled binary, model and voice with its license; the app menu
opens it from "Acerca de / Licencias". ffmpeg is a GPL build (it includes libx264).
