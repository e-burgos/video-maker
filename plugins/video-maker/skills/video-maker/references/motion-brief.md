# Motion brief reference

Generated from libs/motion-graphics/src/auto/motion-brief.ts — do not edit by hand; run `pnpm nx run plugin-references:plugin-references`.

Machine-readable schema: `schemas/motion-brief.schema.json`.

| Field | Type | Required | Allowed values | Default | Applies to | Description |
| --- | --- | --- | --- | --- | --- | --- |
| `version` | const 1 | yes | `1` |  |  |  |
| `brand` | string (pattern ^[a-z][a-z0-9-]*$) | yes |  |  |  |  |
| `title` | string | no |  |  |  |  |
| `format` | enum | no | `16:9`, `9:16` | `16:9` |  |  |
| `beatSync` | boolean | no |  | `true` |  |  |
| `music` | const auto \| string \| null | no | `auto` | `auto` |  |  |
| `goal` | string | no |  |  |  |  |
| `audience` | string | no |  |  |  |  |
| `script` | string | yes |  |  |  |  |
| `images` | object[] (maxItems 12) | no |  | `[]` |  |  |
| `images[].file` | string | yes |  |  |  |  |
| `images[].caption` | string | yes |  |  |  |  |
| `images[].boxes` | object[] (maxItems 40) | no |  |  |  |  |
| `images[].boxes[].name` | string | yes |  |  |  | Name of the region as the dev gave it, e.g. "Tarjeta Plan Propio" |
| `images[].boxes[].x` | number (min 0, max 1) | yes |  |  |  | Left edge as a fraction of the image width |
| `images[].boxes[].y` | number (min 0, max 1) | yes |  |  |  | Top edge as a fraction of the image height |
| `images[].boxes[].w` | number (max 1) | yes |  |  |  | Width as a fraction of the image width |
| `images[].boxes[].h` | number (max 1) | yes |  |  |  | Height as a fraction of the image height |
| `images[].boxes[].source` | enum | no | `given`, `measured` | `given` |  | given: the dev provided it; measured: the producer measured it on the capture |
| `images[].boxes[].measuredBy` | string | no |  |  |  | Who measured the box, only when source is measured |
| `images[].boxes[].measuredAt` | string | no |  |  |  | ISO instant of the measurement, only when source is measured |
