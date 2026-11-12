# Video Maker plugin for Claude Code

Open any project (an API, a library, a mobile app, a store, a backoffice…), install this plugin and ask
for a video: "make a tutorial of the checkout", "a 45 second promo", "a video to sell this to a local
shop". The agent reads the repository, sets up the brand, records the UI or writes an animated brief, and
drives your local Video Maker studio until a render passes review. You confirm the decisions and publish
from the studio.

## Requirements

- **A running Video Maker studio** on this machine:
  - the Video Maker desktop app, open (download: https://video.estebanburgos.com.ar), or
  - `pnpm studio` in a clone of the [video-maker](https://github.com/e-burgos/video-maker) repository.
- Node.js 22 or newer (the MCP server runs with `npx`).
- For recorded tutorials: Playwright with Chromium and ffmpeg (the screen-capture skill explains a
  zero-footprint install outside your repo).

## Install

```text
/plugin marketplace add e-burgos/video-maker
/plugin install video-maker@video-maker
```

Restart Claude Code if it asks, then ask for a video in plain words.

## What is inside

| Part | What it does |
| --- | --- |
| `video-maker` skill | entry point: finds the studio, reads the project, picks the kind of video, agrees it with you in one round, produces and reviews it |
| `video-maker-brand` skill | derives the brand (name, spoken name, palette with measured contrast, logo with transparency, fonts, voice, music) from the repo, or reuses an existing one |
| `video-maker-motion-brief` skill | animated videos: script, described images, storyboard review, render and visual review |
| `video-maker-screen-capture` skill | records any web UI with Playwright (`scripts/record.mjs` + a `flow.mjs` per video) into a silent 1080p30 recording and a timed script |
| `video-maker-raw-material` skill | your own clips, photos, voice-over, music and logo; free media with licenses and credits |
| MCP server `video-maker` | `npx -y @e-burgos/video-maker-mcp`: projects, uploads, brands, briefs, storyboards, jobs, timeline, music and render reviews |

Publishing and deleting are never exposed to the agent: you do them in the studio.

## How the MCP server finds the studio

1. `VIDEO_MAKER_API_URL` (and `VIDEO_MAKER_API_TOKEN` when the studio needs one), if set.
2. Otherwise `~/.video-maker/studio.desktop.json` (the desktop app), then `~/.video-maker/studio.dev.json`
   (`pnpm studio`); stale files are skipped. `VIDEO_MAKER_HOME` changes that folder.

The desktop app wins when both are running; set `VIDEO_MAKER_API_URL` to force the other one.

## Local development of the plugin

From a clone of video-maker:

```bash
pnpm nx run producer-tools:pack-mcp     # bundles the MCP server into dist/packages/video-maker-mcp
```

Then, in the project where you want to test it:

```text
/plugin marketplace add /absolute/path/to/video-maker
/plugin install video-maker@video-maker
```

To run the local MCP bundle instead of the published npm package, start Claude Code with:

```bash
export VIDEO_MAKER_MCP_PACKAGE=/absolute/path/to/video-maker/dist/packages/video-maker-mcp
claude
```

`.mcp.json` runs `npx -y ${VIDEO_MAKER_MCP_PACKAGE:-@e-burgos/video-maker-mcp}`, and `npx` accepts a local
package folder. After editing skills, run `/plugin marketplace update video-maker` (or reinstall) to pick
up the changes.

Checks in the video-maker repo:

```bash
pnpm nx run plugin-references:test       # skills only name real fields; plugin and MCP versions match
claude plugin validate .                 # marketplace manifest
claude plugin validate plugins/video-maker
```

The plugin version (`.claude-plugin/plugin.json` and the marketplace entry) always equals the npm
package version in `libs/producer-tools/npm/package.json`.

## License

MIT
