# Deriving a brand from any repository

## 1. Finding the colors

Search in this order and keep the first source that gives a coherent set:

1. Design tokens or theme files: `tokens.json`, `theme.ts`, `colors.ts`, `tailwind.config.*`
   (`theme.extend.colors`), CSS files with `:root { --primary: … }`, `@theme` blocks (Tailwind 4).
2. The web manifest (`manifest.json`, `site.webmanifest`): `theme_color`, `background_color`.
3. Mobile resources: Android `res/values/colors.xml`, iOS asset catalogs (`*.colorset/Contents.json`),
   Flutter `ThemeData`.
4. The logo itself: sample its dominant colors if nothing else exists.

Map them: the darkest or lightest surface → `background`; the body text color on it → `text`; primary
brand color → `accent`; secondary or hover color → `accent2`. Convert `rgb()`, `hsl()` and `oklch()` to
`#rrggbb`. If the product has light and dark themes, pick the one that looks best on video (dark
backgrounds hide compression noise better) and say so.

Run `scripts/contrast.mjs <background> <text> <accent> <accent2>`; exit code 1 means a pair failed.

## 2. Finding the logo

```bash
git ls-files | grep -iE '(logo|wordmark|brand|isotipo|icon|mark)[^/]*\.(svg|png|webp)$' | head -30
```

- Prefer SVG: it scales and always has transparency. An SVG that embeds text in a font the studio does
  not have renders with a fallback font: convert text to paths or upload the font too.
- PNG: check `pix_fmt` (see SKILL.md) and width ≥ 800 px.
- A logo on a white or colored rectangle has no transparency even if it is a PNG: ask for a clean file.
- If the repo has none, the starter brand's generated wordmark (the name in the display font) is a
  correct fallback; say so to the user.

## 3. Fonts

- Look for `@font-face`, `next/font/google`, `<link href="https://fonts.googleapis.com/…">`, font files
  (`*.woff2`, `*.ttf`, `*.otf`).
- Only upload font files that live in the repo or that have an open license (OFL, Apache). Google Fonts
  families are OFL: download the woff2 of the weights used.
- `typography.display` is for titles, `typography.body` for texts, `typography.mono` optional for code.
  Each family named there needs an entry in `fonts` (family + uploaded file path).
- If you cannot get the files, keep the starter fonts and tell the user.

## 4. Devices (products with hardware)

When the product lives on a physical device, a device entry lets scenes put screenshots inside it.

- `image`: a product photo on a transparent or plain background, uploaded with kind `device`.
- `kind`: `screen` (a monitor, TV or display), `counter` (a device standing on a counter or desk), `box`
  (a box without its own screen).
- `screen.polygon`: the four corners of the visible screen area as `[x, y]` percentages (0–100) of the
  image, clockwise from top-left. Measure them on the image (open it and read the pixel positions).
- `screen.aspect`: width / height of the content shown inside; `skew` and `rotate` (degrees) fine-tune
  perspective.
- `spokenName`: how the voice says the model name. `retired: true` hides a model that is no longer sold.

## 5. Voice

- `list_voices` returns ids with language and accent. Choose one that matches the audience's language and
  region. A brand voice applies to every video of the brand; a video can still choose another.
- `voice.lengthScale` between 0.7 (faster) and 1.4 (slower).

## 6. Typical mistakes

| Mistake | Effect | Fix |
| --- | --- | --- |
| Logo PNG without alpha | white box over every video | SVG or transparent PNG |
| Accent too close to background | titles and highlights disappear | darker or lighter shade until ≥ 3:1 |
| `spokenName` equal to a stylized name ("ACMEpay") | the voice spells or mangles it | write it as it sounds |
| Manifest path different from the uploaded path | update_brand fails with a missing file | use the path upload_brand_file answered |
| Sending only the changed keys to update_brand | the rest of the manifest is lost or rejected | always send the whole manifest from get_brand |
