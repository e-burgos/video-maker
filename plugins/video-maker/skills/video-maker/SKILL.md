---
name: video-maker
description: Make a finished, reviewed video about the project open in this session with the local Video Maker studio — a recorded tutorial of its web UI, a promo, a sales pitch for business customers, an explainer, a reel or a short. Use it whenever the user asks to "make / create / produce a video", "a tutorial", "a demo", "a promo", "a reel", "a short", "a sales video", "an explainer" or "a video to sell this" about this repository, product, API, library, app or store, even if they never mention Video Maker. It reads the repo, agrees the video in one round, prepares the brand and the material and drives the studio through its MCP tools until a render passes review.
---

# Video Maker — entry point

You turn the project open in this session into a video, using the Video Maker studio that runs on this
machine. You decide the content; the studio's engine animates, voices, mixes and renders. The user only
confirms decisions and, at the end, publishes from the studio.

## 0. Rules that apply to every step

- **Talk to the user in the user's language** (the language of their messages), in plain words. Never show
  a job kind, a flag, a preset id, a format id, a tool name, a JSON key or a file path as something to
  decide. Translate both ways: "for YouTube" → `youtube-16x9`; "voice with AI" → a voice job; "subtitles
  like Netflix" → `subtle-lower`. Give a path only when the user asks for it.
- **Narration uses the pronounceable form** (the brand's `spokenName`, numbers as they are said). Exact tokens such as package names, commands and URLs go in on-screen text, never only in the voice.
- **Never invent facts.** Every claim in a script (features, numbers, prices, customers, results, dates)
  must come from this repository or from the user. If it is not there, ask or leave it out.
- **One round of questions**, with a concrete recommendation for each, so the user can just say "yes".
- **Stop for the user's OK twice**: after the plan (before creating anything heavy) and after the
  storyboard or the first review (before the full render).
- Publishing and deleting are never yours: the user does them in the studio.
- Do not change the host project's code, config or dependencies to make a video, unless the user asks.

## 1. Find the studio

Call `studio_status` first.

- It answers → note the version and go on.
- It fails → the studio is not running. Tell the user, in their words, one of these:
  - Install and open the **Video Maker** desktop app (macOS): download from
    https://video.estebanburgos.com.ar (installation guide at
    https://video.estebanburgos.com.ar/en/installation/). While the app is open the studio is available.
  - Or, with the Video Maker source code, run `pnpm studio` in that repository.
  - A studio on another machine or port is selected with the environment variables `VIDEO_MAKER_API_URL`
    and `VIDEO_MAKER_API_TOKEN` (set them before starting Claude Code).
  Then wait and call `studio_status` again. Do not try to start anything yourself.

Then call `get_capabilities` once and keep it: formats, modes, presets, scene kinds, title styles,
bumpers, on-screen text kinds, sound effects and voices that **this** studio supports. The generated
snapshot of the same catalog is in `references/capabilities.md`; the live answer wins when they differ.

## 2. Read the host project (before asking anything)

Spend a few minutes reading; it is what makes the questions concrete. Collect, with the file where you
found each item:

| Look for | Where |
| --- | --- |
| What it is, who it is for, the problem it solves | README, docs folder, landing or marketing pages, app store texts |
| Features and their real names | docs, route names, menu labels, i18n message files |
| Proof points: numbers, customers, integrations, testimonials | only what is written in the repo (landing copy, case studies, docs) |
| Plans and prices | pricing page or config; quote them only if the user wants prices in the video |
| Brand: name, logo files, colors, fonts | `public/`, `assets/`, favicon and manifest files, CSS variables, Tailwind or theme config, design tokens |
| Is there a web UI that can be recorded, and how to run it | package scripts, docker compose, `.env.example`, a staging URL in the docs |
| Language of the product, its audience and its tone of voice (for the script, not for the brand) | UI strings, README and landing copy |

Detailed checklist and search patterns: `guides/reading-the-project.md`.

## 3. Choose the kind of video

| The user wants… | Studio mode | Sub-skill |
| --- | --- | --- |
| a viewer to **repeat a real flow** in the UI (tutorial, how-to, onboarding, help center) | footage (recorded tutorial) | `video-maker-screen-capture`, then the footage steps in §6 |
| to **present or sell** the product (promo, sales pitch, explainer, launch, reel) and understanding the idea is enough | motion (animated video from a brief) | `video-maker-motion-brief` |
| a video of a project **without a UI** (API, library, CLI, service, infrastructure) | motion | `video-maker-motion-brief` |
| a video from **their own clips, photos or voice-over** | footage | `video-maker-raw-material` |
| both a promo and a tutorial of the same thing | two projects, one per mode | both, one after the other |

If the request fits two rows, offer the two options in one sentence each and let the user pick. A motion
video can still show the real product: screenshots of the UI become images of the brief (the
screen-capture sub-skill takes them).

## 4. Agree the video in one round

Ask everything in one message, each item with your recommendation already filled in:

| Question | Recommend |
| --- | --- |
| Where it will be published | YouTube or web → horizontal 16:9. Anything watched mainly on a phone → vertical 9:16: WhatsApp, Instagram, TikTok, Shorts, stories, mobile ads, and also tutorials sent by messaging apps. One format per video; the other one is a second video. A vertical tutorial is recorded with a mobile viewport (540×960 at device scale 2 gives 1080×1920). |
| Length | promo or sales 45–75 s · reel 25–40 s · tutorial 60–180 s · team instructions up to ~2 min |
| Audience and goal | from what you read: who watches and what they should do after |
| Tone | from the product's own copy (formal, close, playful) |
| Voice | a generated voice of the studio (`list_voices`: say gender and accent, not ids) or their own recording |
| Music | the brand's music, a free track matching the mood, or none |
| Call to action | the real next step from the repo (sign-up URL, contact, store) |
| What it must not show | real customer data, credentials, competitor brands |

Narration language: use the audience's language; check `list_voices` has a voice for it, and tell the
user if it does not. Then summarize the plan in three lines in their words and wait for "yes".

## 5. Brand and project

1. Brand: run `video-maker-brand` — it reuses a brand that already exists (`list_brands`) or derives one
   from this repo, proposes it and creates it after the OK.
2. Create the project with `create_project`: a kebab-case slug made of the product and the topic
   (`acme-invoices-promo`), the mode from §3, the brand id and a human title. `list_projects` first: never
   reuse a slug that belongs to another video.
3. Route to the sub-skill. It returns when the material, brief or storyboard is ready.

## 6. Produce

**Motion** — follow `video-maker-motion-brief` until the storyboard is approved by the user.

**Footage** (a recording or the user's material already uploaded with `upload_asset`):

1. Script: `write_project_text` to `work/producer/script.txt`, one sentence per line, each starting with
   its `[m:ss]` mark when it describes what the screen shows.
2. Voice: `start_job` with `{"kind":"voice","scriptPath":"work/producer/script.txt"}`, then
   `wait_for_job`. Lines that did not fit their window are reported; shorten them and re-run with
   `overwrite: true`.
3. Montage: `start_job` with kind `montage`, the format agreed, `voice: "script"`, the same `scriptPath`,
   `preset` (`educational` for calm tutorials, `software-demo` for dynamic ones, `hardware` for ads) and
   `captionStyle` (`subtle-lower` for any recorded UI, `bold-impact` for reels). Do not send `seed`.
4. Logo and intro/outro: `patch_timeline` with `logo` (the uploaded logo, which must have alpha) and
   `bumpers` with intro and outro enabled, 2000 ms, and nothing else: the studio rotates their look.
5. On-screen texts, music level and caption style are also `patch_timeline` sections; never `put_timeline`
   unless the user changes caption words.

**Both modes, before the full render:**

1. `view_images` on every image of the project, then `review_material` (one entry per image; `gaps` lists
   what the idea needs and the material lacks). Skip both when the only image is the logo (the generated
   wordmark or an uploaded one): there is nothing to review.
2. `propose_production`, in **both** modes: 2 or 3 concepts (title, angle, format, duration, scenes,
   delivery kind), the recommended one first. It is what unlocks the full render: the studio refuses it
   until the user opens the project and clicks **Approve this approach** on the concept they want. In
   motion mode the order is storyboard OK first, then `propose_production`. If the user cannot answer
   (headless session), stop there and report what is ready and what is waiting for the approval.
3. Optional and never blocked: a preview of the first 8–20 seconds with `sample: {"seconds": 15}` on the
   render or motion job, to show the look before approving.

## 7. Render and review (never deliver without this)

1. Full render: `start_job` kind `render` (footage) or kind `motion` with `phase: "video"` (motion), then
   `wait_for_job` in steps of up to 600 s until it finishes.
2. `get_render_review`: fix every critical finding (cut a line, lower the music, re-voice), re-render.
3. Motion videos list `sceneFrames`: look at all of them with `view_images` (6 per call) and send
   `record_visual_review` with an honest verdict per scene. Footage: `extract_frames` at the start, the
   key moments and the end, and look at them.
4. If something fails twice at the same point, stop and show the user the literal error.

## 8. Deliver

Tell the user, in their words: duration, format, what the video says in one line, what the review found
and what is still worth improving. Then:

- **Where to see it:** in the studio, the project page (preview and the generated files of the project).
- **Credits:** free music and media carry a license; the credits are in the project and must go in the
  publication's description.
- **Publishing:** the user publishes from the studio's Publication page. You never publish.
- Offer 2–3 concrete next steps ("a vertical cut for reels", "a shorter 30 s version", "the tutorial of
  the same flow").

## Sales or promo video for a business audience

The most common request from a product repo: "a video to sell this to a shop / a clinic / a restaurant /
an agency". Treat it as a first-class case:

- **Structure:** problem (a scene of their day, one concrete pain) → solution (the product, named with
  context) → proof (how it works, 2–3 features as benefits) → offer (what they get, only if written in
  the repo) → call to action (one, real).
- **Speak their language, not the repo's:** "your shop window changes in one minute", not "real-time
  content sync". Features become outcomes for the owner: time, sales, fewer mistakes, looking
  professional.
- **Claims only from the repo or the user.** No invented prices, discounts, percentages, customer names,
  testimonials or awards. If the landing page has a number, you may use it and you say where it came from
  when you show the script.
- **Show the product in the customer's place**: scenes of the counter, the shop window, the phone in the
  owner's hand; real screenshots or the brand's device images, not stock that could be any product.
- Format: 16:9 for a web page or sales call, 9:16 for ads in social networks; 45–60 s, 120–150 words.

Full playbook, scene templates and a worked example: `guides/sales-video.md`.
