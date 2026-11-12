# Brand manifest (brand.json) reference

Generated from libs/motion-graphics/src/brand/brand-manifest.ts — do not edit by hand; run `pnpm nx run plugin-references:plugin-references`.

Machine-readable schema: `schemas/brand.schema.json`.

| Field | Type | Required | Allowed values | Default | Applies to | Description |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | string (pattern ^[a-z][a-z0-9-]*$) | yes |  |  |  |  |
| `name` | string | yes |  |  |  |  |
| `spokenName` | string | yes |  |  |  | How the voice must write the brand name to pronounce it right |
| `tagline` | string | yes |  |  |  |  |
| `taglineAccent` | string | no |  |  |  |  |
| `url` | string | no |  |  |  |  |
| `logo` | string | yes |  |  |  |  |
| `isotipo` | string | no |  |  |  |  |
| `css` | string | no |  |  |  |  |
| `palette` | object | no |  |  |  |  |
| `palette.background` | string (pattern ^#[0-9a-fA-F]{6}$) | yes |  |  |  |  |
| `palette.accent` | string (pattern ^#[0-9a-fA-F]{6}$) | yes |  |  |  |  |
| `palette.accent2` | string (pattern ^#[0-9a-fA-F]{6}$) | yes |  |  |  |  |
| `palette.text` | string (pattern ^#[0-9a-fA-F]{6}$) | yes |  |  |  |  |
| `tokens` | record<string, string> | no |  |  |  |  |
| `typography` | object | no |  |  |  |  |
| `typography.display` | string | yes |  |  |  |  |
| `typography.body` | string | yes |  |  |  |  |
| `typography.mono` | string | no |  |  |  |  |
| `fonts` | object[] (minItems 1) | yes |  |  |  |  |
| `fonts[].family` | string | yes |  |  |  |  |
| `fonts[].file` | string | yes |  |  |  |  |
| `fonts[].weight` | string | no |  |  |  |  |
| `fonts[].unicodeRange` | string | no |  |  |  |  |
| `devices` | record<string, object> | yes |  |  |  |  |
| `devices.*.name` | string | yes |  |  |  |  |
| `devices.*.image` | string | yes |  |  |  |  |
| `devices.*.kind` | enum | yes | `counter`, `box`, `screen` |  |  |  |
| `devices.*.screen` | object | no |  |  |  |  |
| `devices.*.screen.polygon` | any[] (minItems 2, maxItems 2)[] (minItems 4, maxItems 4) | yes |  |  |  |  |
| `devices.*.screen.skew` | number | no |  |  |  |  |
| `devices.*.screen.rotate` | number | no |  |  |  |  |
| `devices.*.screen.aspect` | number | no |  |  |  |  |
| `devices.*.retired` | boolean | no |  |  |  |  |
| `devices.*.plate` | boolean | no |  |  |  |  |
| `devices.*.spokenName` | string | no |  |  |  |  |
| `images` | record<string, string \| object> | yes |  |  |  |  |
| `images.*.file` | string | yes |  |  |  |  |
| `images.*.caption` | string | yes |  |  |  |  |
| `music` | object[] | yes |  |  |  |  |
| `music[].id` | string | yes |  |  |  |  |
| `music[].file` | string | yes |  |  |  |  |
| `music[].credit` | string | yes |  |  |  |  |
| `music[].bpm` | number | yes |  |  |  |  |
| `music[].mood` | string | yes |  |  |  |  |
| `music[].drop` | number (min 0) | no |  |  |  |  |
| `music[].videoTypes` | enum[] (minItems 1) | no | `tutorial`, `product`, `vertical`, `institutional` |  |  |  |
| `bumpers` | object | no |  |  |  |  |
| `bumpers.backgrounds` | enum[] (minItems 1) | no | `solid`, `gradient`, `noise`, `shapes`, `glow` |  |  | Animated backgrounds the intro and outro rotate between |
| `bumpers.reveals` | enum[] (minItems 1) | no | `fade`, `zoom`, `slide-up`, `wipe`, `blur-in`, `pop` |  |  | Logo reveals the intro and outro rotate between |
| `bumpers.outroCaption` | string (maxLength 60) | no |  |  |  | Text typed under the outro logo; defaults to the brand url |
| `musicFrom` | string (pattern ^[a-z][a-z0-9-]*$) | no |  |  |  | Brand whose music bank this brand also uses |
| `voice` | object | yes |  |  |  |  |
| `voice.id` | string | yes |  |  |  |  |
| `voice.lengthScale` | number (min 0.7, max 1.4) | yes |  |  |  |  |
