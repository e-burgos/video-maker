---
name: video-maker-screen-capture
description: Record the real web UI of the project open in this session with Playwright and turn it into a Video Maker tutorial — a silent 1080p30 screen recording plus a narration script timed to each step, uploaded to the studio for voice, captions, logo, music and render. Also takes clean screenshots of the UI for animated videos. Use it for tutorials, how-tos, onboarding videos, demos and screencasts of any web app, dashboard, backoffice, store or landing page that runs locally or in a test environment; if the project has no web UI, it explains how the user can deliver their own recording.
---

# Screen capture (recorded tutorials)

This skill produces **raw material, not the final video**: a silent recording (the A-roll) and a timed
script. The studio then voices the script, adds captions, logo, music and the intro/outro, and renders.

Talk to the user in their language. Describe steps as "I will record: open invoices → pick a customer →
save", never as selectors, flags or file paths.

## 1. Before recording

1. **One goal per video.** "Create an invoice" and "send it" are two videos unless the user wants one.
2. **Source of truth:** the product docs and the UI itself. The narration never claims what the UI does
   not do.
3. **Environment:** record a local or test environment, never production with real data. If the flow
   creates, pays, deletes or emails something, say so and confirm with the user first.
4. **Run the app** the way the repo documents it (README, package scripts, docker compose). Do not change
   the project's code or dependencies; ask if something is missing.
5. **Login off camera:** credentials only from the repo's environment (`.env`, `.env.local` or exported
   variables, typically a seeded demo user). Never write them in the flow, the chat or the script.
6. **Presentable data:** no real customer names, emails, keys or other companies' brands on screen. Use
   seed or demo data, and blur leftovers with the `mask` list of the flow config (CSS selectors).
7. **Format:** tutorials 16:9 (`youtube-16x9`, default). A reel or short is a **separate vertical
   recording** (`reels-9x16`, `tiktok-9x16` or `shorts-9x16`: phone viewport at 2x), never a crop.

## 2. Install once

The recorder is `scripts/record.mjs` in this skill (no dependencies besides Playwright and ffmpeg).

- Playwright: if the host project already has `playwright` or `@playwright/test`, nothing to install.
  Otherwise install it **outside** the repo, so the project is not touched:

  ```bash
  npm install --prefix ~/.video-maker/recorder playwright
  export VIDEO_MAKER_PLAYWRIGHT_DIR=~/.video-maker/recorder
  npx playwright install chromium
  ```

  `PLAYWRIGHT_CHROMIUM_PATH` points at an already installed Chromium instead.
- ffmpeg on the PATH (or `FFMPEG_PATH` / `FFPROBE_PATH`). Without it the raw `.webm` is kept untrimmed.

## 3. Write the flow

Copy `scripts/flow.example.mjs` to a scratch folder outside the repo (for example
`~/.video-maker/flows/<slug>.mjs`) and adapt it. A flow file exports:

| Export | What it is |
| --- | --- |
| `config` | `slug` (kebab-case), `baseUrl`, `format`, `startPath`, optional `apiUrl` (records its JSON responses to verify effects), `viewport`, `scale`, `locale`, `timezoneId`, `mask`, `cursorColor`, `closingSeconds` (still screen at the end), `pace` |
| `narration` | array of sentences, **1:1 and in the same order** as the `hito()` calls |
| `login(page, { baseUrl, env })` | optional, runs in a context that is not recorded; the session is carried into the recording |
| `onNavigate(page)` | optional, runs after every navigation (dismiss a tour, a cookie banner) |
| `default` | `async function` with the steps; returns what it verified |

Inside the default function you get: `hito(label)` (marks where a narration line starts), `lineWindow(n)`
(waits long enough for line `n` to be spoken: words / 2.5 + 0.6 s), `click`, `preciseClick` (for targets
inside scrolling containers), `type` (human typing), `goTo(path)`, `pause(ms)`, `air(seconds)`,
`waitUntil(condition, { outputSeconds })` (a slow wait that is sped up in the final video), `snapshot(name,
{ fullPage })` (a PNG for motion videos), `page`, `env` and `apiJson`.

Rules:

- **Map the UI in the code first**, all at once: grep the components for `aria-label`, `title`, button
  texts, roles. Prefer `getByRole` / `getByLabel` with case-insensitive regexes (CSS may uppercase text).
- One `hito()` per scene, called when the scene starts; its sentence goes in `narration`.
- Human cursor and typing only (`click`, `type`); never `fill()` on camera.
- Verify the effect, not the absence of errors: with `apiUrl`, check `apiJson` for the request that
  created the thing, and return it.

## 4. Rehearse once, then record

```bash
node <this skill>/scripts/record.mjs ~/.video-maker/flows/<slug>.mjs --rehearsal
node <this skill>/scripts/record.mjs ~/.video-maker/flows/<slug>.mjs
```

- `--rehearsal` runs the whole flow without recording and prints the milestones and the result. Fix
  selectors until it passes **in one go**; do not rehearse step by step.
- The take writes to `~/.video-maker/recordings/<slug>/` (or `--out <dir>`): `<slug>.mp4` (1920×1080 or
  1080×1920, 30 fps, H.264 yuv420p, silent, trimmed to start just before the first milestone),
  `script.txt` (one `[m:ss] sentence` per line), `milestones.json` and `images/` (snapshots).
- The command prints a JSON summary with absolute paths and a `verification` block (orientation, pixel
  format, fps, increasing marks inside the recording). Exit code 1 means the flow or the check failed.
- Look at frames before uploading: the first one, each risky moment and the last one (`ffmpeg -ss <t> -i
  <file> -frames:v 1 frame.png`, or `extract_frames` once uploaded).
- If only one stretch failed, record a second take from the same state and join them with `joinTakes`
  and `writeTimedScript` exported by `record.mjs` (see `references/recording-guide.md`).

## 5. Hand it to the studio

1. Project in footage mode (`create_project`, see the entry skill).
2. `upload_asset` role `aroll` with the absolute path of `<slug>.mp4`.
3. `write_project_text` to `work/producer/script.txt` with the content of `script.txt`.
4. Continue with the entry skill's footage steps (voice → montage with `subtle-lower` captions →
   logo and intro/outro → proposal → render → review).
5. Snapshots for a motion video: `upload_asset` role `image` and describe each one in the brief.

## 6. Narration rules

- The audience's language and register; one idea per sentence; ~2.5 words per second.
- Open with a question or a concrete need; close with what to do next.
- The brand never at the very start or end of a line; numbers as they are said; no URLs or acronyms
  spelled out.
- If the UI is too fast for a sentence, add `air()` after the action; never speed up the voice.

## 7. Recording is a QA session

If the recording shows something wrong (a broken layout, an error, a text that lies), do not hide it with
framing: stop, tell the user what you saw and let them decide. What a tutorial shows becomes documentation.

## 8. No web UI?

If the project has no recordable web UI (an API, a CLI, a native or mobile app, hardware):

- Prefer a motion video (`video-maker-motion-brief`); screenshots or terminal captures can be images.
- Or the user records their own screen or device and you upload it as A-roll: see
  `video-maker-raw-material` for the exact specs (orientation, 30 fps, silent or with their voice).

Lessons that cut a tutorial from hours to ~40 minutes: `references/recording-guide.md`.
