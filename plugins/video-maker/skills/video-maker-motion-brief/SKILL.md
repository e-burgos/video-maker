---
name: video-maker-motion-brief
description: Write the brief of an animated (motion graphics) video in Video Maker and drive it to a reviewed render — script, described images, format, music — for any topic, including projects without a UI (an API, a library, a CLI, a backend service) and sales pitches to business customers. Use it for promos, sales videos, explainers, launch videos, reels and shorts that do not need a real screen recording, after the video-maker entry skill chose the motion mode.
---

# Motion brief → storyboard → render

In motion mode you deliver **what** to say and show; the studio's storyboard AI chooses animated scenes
from its catalog, the engine voices every scene, cuts to the music, adds transitions and sound effects,
and renders. You write the brief, review the storyboard with the user, and review the render.

Talk to the user in their language. Show the script as plain text and the storyboard as a numbered list
of scenes in words ("3 — a phone receives the booking, title 'Booked in three taps'"), never as JSON.

References (generated, read-only): brief fields `../video-maker/references/motion-brief.md`, storyboard
fields `../video-maker/references/motion-storyboard.md`, engine catalog
`../video-maker/references/capabilities.md` (the live `get_capabilities` answer wins). Worked examples:
`references/brief-examples.md`.

## 1. What the engine can do today (read before promising)

From `get_capabilities` → `motion`:

- **Scene kinds** (`sceneKinds`): hooks, problem lists, brand reveal, features with bullets, product with
  a visual, dashboards, schedules, steps, connections, UI walkthroughs over a screenshot, do/don't,
  galleries and the call to action. Visuals inside a scene can be an image, a brand device with the
  product's screen inside, a phone, tablet or TV frame, an icon, a countdown, a timer, three device
  captures of the same site, or one of the built-in animations (`animations`).
- **Title entrances** (`titleStyles`) and **scene exits** (`sceneExits`): the studio rotates them so no two
  neighbor scenes repeat; set one only when the user asks for a look.
- **Sound effects**: whooshes on scene changes and an impact on the music drop are automatic and measured
  against the voice.
- **Intro and outro with the logo** come from the brand.
- **Not possible**: showing a real screen recording (that is footage mode), seeing your images (the AI only
  reads their captions), several voices, live data.

## 2. Write the script

- Plain text, exactly as it will be spoken, in the audience's language. ~2.5 words per second.

  | Destination | Brief `format` | Length | Words |
  | --- | --- | --- | --- |
  | YouTube, web, sales call | `16:9` | 45–75 s | 110–180 |
  | Team instructions | `16:9` | up to ~2 min | up to ~300 |
  | Reels, TikTok, Shorts | `9:16` | 25–40 s | 60–100 |
  | Stories, short ad | `9:16` | 15–25 s | 40–60 |

- The storyboard needs 6 to 12 scenes: one sentence per idea, 8–14 sentences in total.
- Open with a question or a concrete pain; close with one call to action. Short sentences.
- **Every claim comes from the repo or the user** (see the entry skill). For a sales video follow
  `../video-maker/guides/sales-video.md`.
- The brand name always with context and never at the very start or end of a line; numbers written as
  they are said; no URLs, versions or acronyms spelled out in the narration (they go on screen).
- Narrate the pronounceable form (the brand's `spokenName`, "dot com" omitted, a package said as people
  say it). The exact token (package name, command, URL) goes in the scene's on-screen text, never only in
  the voice, so the viewer can copy it.
- Accents and special letters stay in the script; only file names are ASCII.

### Projects without a UI

Show what the developer or the business gains, not the code:

| Project | Scenes that work |
| --- | --- |
| API | the problem it removes → one request and its answer as a short code-like line on screen → what you can build → integration steps → docs link on screen |
| Library / SDK | the pain without it → install in one line → the 3 things it does → who uses it (only if written) → get started |
| CLI | the repetitive task → one command → before/after → options that matter → install |
| Backend service / infra | what breaks or costs today → how the service fixes it (connections, schedule, dashboard scenes) → reliability facts from the docs → contact |

Code on screen: one short line per scene, taken literally from the README or docs.

## 3. Images (optional, 0–12)

- jpg, png or webp, ≥ 1280 px on the long side, the same orientation as the format when possible.
- Sources: real screenshots of the product (the `video-maker-screen-capture` sub-skill can take them, also
  full-page captures for desktop, tablet and phone), photos in the repo, the user's photos, free media.
- **Look at each image before using it** and write a one-line `images[].caption` saying what it really
  shows. Nothing with real customer data, emails, credentials or other companies' brands.
- If the user or the material gives positions of UI elements in a screenshot, add them as
  `images[].boxes` (name + x, y, w, h as 0–1 fractions); boxes you measured yourself carry
  `source: "measured"`. Scenes then point highlights and clicks at those boxes by name.
- Upload each one with `upload_asset` (role `image`, absolute `filePath`, ASCII lowercase filename).
- The brand's own photos (`get_brand` lists them with their captions) are used as `brand:<key>` in the
  storyboard, with no upload. Never upload a copy of a brand photo as a project image: the AI may pick
  both and the same photo shows twice.
- A gallery scene takes 2 to 4 images; a storyboard with more is rejected.

## 4. The brief

```json
{
  "version": 1,
  "brand": "<brand id>",
  "title": "<human title>",
  "format": "16:9",
  "beatSync": true,
  "music": "auto",
  "goal": "<what the viewer should do or understand, one or two sentences>",
  "audience": "<who watches, in plain words>",
  "script": "<the script, plain text>",
  "images": [{ "file": "dashboard.png", "caption": "The weekly sales dashboard with three charts" }]
}
```

- `music`: `"auto"` lets the AI pick from the brand's music bank by the script's mood, a track id
  (`get_motion_brands` lists them), or `null` for no music. It only takes ids of the project brand's own
  bank. A new brand has an empty bank: fill it first with the brand sub-skill (`search_free_music` then
  `import_brand_music`, or tracks the user owns). `musicFrom` is only for sub-brands of the same owner,
  never to borrow another company's bank.
- `beatSync: true` cuts scenes on the beat; `false` follows the voice (better for calm explainers).
  On the beat every scene lasts at least 2 bars in 9:16 and 3 in 16:9 (the call to action and galleries
  longer): about 4 and 6 s at 120 BPM. Estimate scenes × that before choosing it; for a reel under 40 s
  with more than 7 scenes use `false`.
- Save it with `write_motion_brief` (`brief` = the object). Invalid → the hint names the field; fix it
  and call again.

## 5. Storyboard, then the user's OK

1. `start_job` with `{"kind":"motion","phase":"storyboard"}`; `wait_for_job` (3–6 minutes).
2. `read_motion_storyboard`. Check, scene by scene:
   - it follows the script order and every `scenes[].vo` says only what the script says. Read each
     `vo` next to its script line: the AI paraphrases and adds claims ("attracts customers", "no
     technician needed"), reads URLs, emails or phone numbers aloud (they go on screen only) and puts
     the spoken form of a name on screen. Fix every one before showing the storyboard;
   - no scene invents a feature, number, price or customer;
   - images land where their caption fits; device and UI scenes show the right product;
   - the last scene is the call to action and the brand appears with context.
   - on-screen labels stay short: in 9:16 a schedule block wraps to two lines at most (about 24
     characters), chips and bullets fit one line.
3. Show it to the user as a numbered list in words and ask for changes. **This is the cheap moment to
   fix things.**
4. Small changes: edit the storyboard JSON minimally and save it with `write_motion_storyboard` (the
   hint names a bad field). Big changes: fix the brief and repeat step 1 with `overwrite: true`.
5. Voice delivery per scene: `scenes[].direction` (pace, energy, pause after, emphasis words).
6. Optional preview: `start_job` `{"kind":"motion","phase":"video","sample":{"seconds":15}}` renders the
   first seconds without approval.

## 6. Approval, render, review

1. `view_images` on every project image and `review_material` (skip both when the only image is the
   logo), then, once the user has approved the storyboard, `propose_production` with 2–3 concepts
   (delivery kind `motion`). It unlocks the full render: the user approves one in the studio ("Approve
   this approach"). If the user cannot answer (headless), stop here and report.
2. `start_job` `{"kind":"motion","phase":"video","output":"video.mp4"}`; `wait_for_job` in steps of up to
   600 s (about 30 s per voiced line plus ~2.5 min per minute of video). After storyboard edits, add
   `overwrite: true`, and start the job only after `write_motion_storyboard` answered OK: the render reads
   the storyboard saved at that moment.
3. `get_render_review` with `file` `out/video.mp4`: fix critical findings. Then look at every frame in
   `sceneFrames` with `view_images` and send `record_visual_review` (per scene: what it shows, matches
   the voice, legible, could be another product, verdict, note). Any scene marked fix → change the
   storyboard and render again.
4. Deliver as the entry skill says (§8 there): duration, format, what it says, review result, credits
   (music credits must go in the publication's description), and that the user publishes from the studio.

## Errors you may see

| Error | Meaning and action |
| --- | --- |
| `BRIEF_INVALID` | a field breaks the brief schema; the hint names it |
| `BRAND_NOT_FOUND` | the brief's brand does not exist: `list_brands` |
| `MOTION_PROJECT_REQUIRED` | the project was created as footage: create a new one with mode motion |
| `BRIEF_MISSING` / `STORYBOARD_MISSING` | run the previous step first |
| `STORYBOARD_ALREADY_EXISTS` | send `overwrite: true` to redo it |
| `STORYBOARD_INVALID` | the AI could not produce a valid storyboard; show the message and retry once |
| `PROPOSAL_NOT_APPROVED` | the user has not approved a proposal in the studio yet; if they say they did, ask them to check that the card now shows the approved concept, then try once more |
| `AI_AGENT_*` | the studio's AI is unavailable (session, usage limit): show the literal message, retry later |
