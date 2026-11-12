---
name: video-maker-brand
description: Create or reuse the Video Maker brand of the project open in this session — name, spoken name for the voice, tagline, a 4-color palette with measured contrast, logo with transparency, fonts, voice and music — derived from the repository's own files (README, landing copy, CSS, Tailwind or theme config, web manifest, logo assets). Use it before producing any video with Video Maker, or when the user asks to set up, fix or change the brand, colors, logo or voice of their videos.
---

# Video Maker brand

Every video uses a brand of the studio: it gives the colors, fonts, logo, intro/outro look, voice and
music bank. Your job is to get a correct brand for **this** project with the least effort for the user.

Talk to the user in their language and show the brand as a short visual summary (name, colors as hex
swatches, logo file, font, voice described in words), never as JSON.

Field reference of the manifest: `../video-maker/references/brand.md` (schema:
`../video-maker/references/schemas/brand.schema.json`). Derivation details and edge cases:
`references/deriving-a-brand.md`.

## 1. Reuse first

1. `list_brands`. If one matches the product (same name or an id derived from it), `get_brand` and show it.
2. Ask only "use it as is, or adjust something?". Built-in brands cannot be changed: to adjust one,
   create a user brand with `duplicateFrom` set to it.
3. If none matches, derive a new one (§2).

## 2. Derive from the repo

Collect each item with the file it came from:

| Manifest field | Where it comes from |
| --- | --- |
| `name` | product name as the README, manifest or landing page writes it |
| `spokenName` | the same name written the way a voice must say it ("Acme Pay" for "AcmePay", "Jey Ess Kit" for "JSKit" only if that is how people say it); ask the user when unsure. Exact tokens (package names, commands, URLs) are never spoken: they go on screen, see the motion-brief skill |
| `tagline` | the landing hero line or the package description, ≤ 8 words |
| `url` | the public site of the product (homepage in the package manifest, landing page); it is the default outro caption |
| `palette.background`, `palette.accent`, `palette.accent2`, `palette.text` | CSS variables, Tailwind theme, design tokens, web manifest `theme_color` / `background_color` |
| `logo` | an SVG or PNG wordmark in the repo; must have transparency (§3) |
| `typography.display`, `typography.body` and the `fonts` files | the families the product uses, as woff2/ttf/otf files |
| `voice.id` | a voice from `list_voices` in the audience's language |

### Palette (4 colors, contrast measured)

- `background`: the color most videos sit on (dark or light, from the product's own surfaces).
- `text`: the main text color on that background.
- `accent` and `accent2`: the two brand colors used for highlights, gradients and buttons.
- Measure contrast with `scripts/contrast.mjs` (WCAG ratio):

  ```bash
  node <this skill>/scripts/contrast.mjs '#0b1020' '#f5f7ff' '#6d5dfc' '#22d3ee'
  ```

  `text` on `background` must be ≥ 4.5; each accent on `background` ≥ 3. If a pair fails, propose the
  closest shade that passes and say which one you changed.

### Logo with transparency (pix_fmt rule)

A logo without an alpha channel is drawn as a box over the video. For raster files check the pixel
format with `ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 <file>`:
`rgba`, `bgra`, `ya8`, `pal8` or any format with an `a` has transparency; `rgb24`, `yuv420p`, `gray` do
not. Prefer, in this order: an SVG wordmark, a PNG with alpha ≥ 800 px wide, a square mark from the web
manifest. Never pick one without alpha silently: offer to go without a logo or ask for a transparent file.
Horizontal wordmarks work better than square icons; keep the square one as the optional `isotipo`.

### Voice and music

- The brand manifest has no tone field. How the product talks ("close and direct, no jargon") belongs to
  the brief and the script of each video, not to the brand.
- Voice: `list_voices`; describe two candidates to the user in words (gender, accent, energy).
  `voice.lengthScale` 1.0 is normal speed, 1.08 slightly calmer.
- Music: a new brand starts with an empty bank, and the brief `music` field only takes ids of the
  brand's own bank. Ways to fill it:
  - `musicFrom` (id of another brand) only for a sub-brand of the same owner that shares its parent's
    music. Never use it to borrow another company's bank.
  - Tracks the user owns: `upload_brand_file` kind `music`, then `update_brand` adding the entry.
  - Free tracks, with no download on your side: in a project of this brand run `search_free_music`
    (each result shows title, author, license and page URL), pick one whose license is not share-alike,
    then call `import_brand_music` with the project slug, the `resultId`, the brand `id`, an estimated
    `bpm`, a short `mood` and optionally `videoTypes`. The studio downloads the file (mp3, wav or m4a),
    stores it in the brand and appends the track with its `credit` (title, author, license). Use the
    answered `track.id` in the brief.
  - Any entry needs `id`, `file`, `credit`, `bpm` and `mood`; `drop` and `videoTypes` are optional.

## 3. Propose, then create

Show the summary and wait for the OK. Then:

1. `create_brand` with `name` (and `id`, kebab-case starting with a letter). The studio creates a starter
   manifest with default fonts and a generated wordmark.
2. `upload_brand_file` for each file: kind `logo` (svg, png, webp, jpg), `font` (woff2, ttf, otf),
   `music` (mp3, wav, m4a; a free track goes through `import_brand_music` instead), `image` (photos the scenes can use), `device` (product hardware). Each upload
   answers the stored relative path; use exactly that path in the manifest.
3. `get_brand`, change only what you derived, and send the **whole** manifest with `update_brand`. The
   studio validates it and names the offending field when invalid: fix that field and send again.
4. `get_brand` again and confirm to the user, in words, what the brand now has.

Never edit a built-in brand, never delete a brand (the user does that in the studio) and never upload
files the repo does not own the rights to (a client's logo, a font without a license file).

## 4. Optional parts that make videos better

- `images`: photos the motion scenes may use, each with a one-line `caption` saying what it shows (the
  storyboard AI reads the caption, it does not see the photo).
- `devices`: when the product runs on hardware (a screen, a kiosk, a terminal, a tablet stand), upload a
  clean product photo as kind `device` and describe its screen area as a 4-point polygon so scenes can put
  the product's UI inside it. See `references/deriving-a-brand.md` §4.
- `bumpers`: limit the intro/outro looks to the ones that suit the brand (`bumpers.backgrounds`,
  `bumpers.reveals`), and set `bumpers.outroCaption` if the outro should type something other than the
  url.
