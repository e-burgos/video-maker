# patch_timeline real smoke — move the logo without touching captions

Date: 2026-09-25T20:22:08.696Z
render-api port: 4601
Project: display-ads-crear-grupo (temp clone, discarded after the run)

## Request to the real studio MCP server (claude CLI, model haiku)

> Move the logo overlay to the bottom-left corner of the video, at 40% opacity. Do not change
> anything else about the timeline: not the captions, not the voice, not any other section.

## Tool calls made by the model

- `mcp__studio__get_project_overview`: {}
- `mcp__studio__get_timeline`: {}
- `mcp__studio__patch_timeline`: {"logo":{"assetId":"raw/logo/logo-largo.png","position":"bottom-left","widthRatio":0.18,"marginRatio":0.035,"opacity":0.4}}

Tool used for the change: **patch_timeline**

## Model's answer

> Done. The logo is now positioned at the bottom-left corner with 40% opacity. All other timeline elements (captions, voice, music, bumpers) remain unchanged.

## Timeline logo — before / after

```json
{
  "assetId": "raw/logo/logo-largo.png",
  "position": "bottom-right",
  "widthRatio": 0.18,
  "marginRatio": 0.035,
  "opacity": 0.5
}
```

```json
{
  "assetId": "raw/logo/logo-largo.png",
  "position": "bottom-left",
  "widthRatio": 0.18,
  "marginRatio": 0.035,
  "opacity": 0.4
}
```

- Logo moved to `bottom-left` at opacity `0.4`: **PASSED**

## Caption words — before / after

- Caption word count before: 105
- Caption word count after: 105
- Every caption word identical, including diacritics: **PASSED**
