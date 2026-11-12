# @e-burgos/video-maker-mcp

MCP server for [Video Maker](https://github.com/e-burgos/video-maker). It talks to a studio running on your machine: the Video Maker desktop app, or `pnpm studio` in the video-maker repository.

```
npx -y @e-burgos/video-maker-mcp
```

## How it finds the studio

1. `VIDEO_MAKER_API_URL` (and `VIDEO_MAKER_API_TOKEN` when the studio needs one) forces a studio.
2. Otherwise it reads `~/.video-maker/studio.desktop.json`, then `~/.video-maker/studio.dev.json` (`VIDEO_MAKER_HOME` changes the folder), skips stale files and checks `GET /health`.

If none answers, tools fail with a message asking to open the Video Maker app or run `pnpm studio`.

## Tools

Global: `studio_status`, `get_capabilities`, `list_projects`, `create_project`, `list_brands`, `get_brand`, `create_brand`, `update_brand`, `upload_brand_file`, `list_voices`, `get_motion_brands`.

Per project (all take a required `slug`): `upload_asset`, `get_project_overview`, `start_job`, `wait_for_job`, the brief, storyboard, timeline, music, review and voice tools.

Publishing and deleting are never exposed: the user does them in the studio.

Requires Node 22 or newer.
