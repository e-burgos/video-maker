---
name: video-maker-raw-material
description: Prepare and upload the user's own material to Video Maker — screen or camera recordings, product clips, photos, a voice-over, music and the logo — with the right roles, names, specs and orientation for a horizontal (16:9, YouTube/web) or vertical (9:16, Reels/TikTok/Shorts) video, plus free media from open banks with their licenses and credits. Use it when the user brings files of their own, records their own screen or device, has no recordable web UI, or asks to add photos, clips, music or a voice-over to a video.
---

# Raw material

The footage mode of the studio edits real material: one main video (the A-roll) that sets the length and
the cuts, plus support clips and photos, music, logo and narration. This skill gets that material right
before it reaches the studio, so the montage works the first time.

Talk to the user in their language; ask for files by what they are ("the recording of your phone", "a
photo of the shop window"), never by role names or folders.

Detailed specs, ffmpeg recipes and the concept-matching rules: `references/material-specs.md`.

## 1. Roles

`upload_asset` takes a `role`, an absolute local `filePath` and an optional `filename`:

| Role | What it is | How many |
| --- | --- | --- |
| `aroll` | the main video: screen recording, camera, phone, or the user's clip that carries the story | exactly **1** |
| `broll` | support clips without voice | 0..n |
| `image` | support photos and screenshots | 0..n |
| `audio` | the music bed | 0..1 used |
| `voice` | a voice-over recorded by the user | 0..n |
| `logo` | the logo, **with transparency** | 0..1 used |
| `reference` | a video the user wants theirs to feel like (pace, style), analysed with a `reference` job | 0..n |

Every montage starts from an A-roll. If the user only has photos, a `photo-aroll` job turns them into
one (or make a motion video instead).

## 2. Names

- File names are ASCII, lowercase, no spaces, no folders: `shop-window.jpg`, not `Shop Window (1).JPG`.
- **Support clips and photos are named by the concept the narration says**, one word per concept:
  `shelves.mp4` appears when the voice says "shelves". `IMG_2041.jpg` or `screen-01.mp4` never appear.
  Repeat each concept in the script as often as the preset needs (3 times for `software-demo`,
  `hardware`, `recipe`; 4 for `educational`). See `references/material-specs.md` §3.
- The A-roll, music, logo and voice-over can have any name.
- An existing name cannot be uploaded again: pick a new name (the user deletes old files in the studio).

## 3. Specs that matter

| Material | Rule |
| --- | --- |
| Orientation | everything in the orientation of the output: 16:9 for YouTube and web, 9:16 for reels. A horizontal recording in a vertical video is cropped at the sides and the UI becomes unreadable. A second format is a second recording. |
| Video | `.mp4` `.mov` `.mkv` `.avi` `.webm`; H.264 yuv420p, 25–60 fps constant; 1920×1080 or 1080×1920 (≥ 1280×720) |
| A-roll audio | silent when the studio generates the voice; with a clear voice track when the user narrates in it |
| Support clips | 5–30 s, without audio, same orientation |
| Photos | `.jpg` `.jpeg` `.png` `.webp` (no svg, gif, heic), ≥ 1280 px on the long side |
| Music | `.mp3` `.wav` `.m4a` `.aac` `.flac`, **longer than the video**, no lyrics in the narration's language |
| Logo | PNG (or webp) **with alpha**, ≥ 800 px wide, horizontal works best; check `pix_fmt` (`rgba`, `ya8`, `pal8` have alpha; `rgb24`, `yuv420p` do not) |
| Voice-over | WAV 48 kHz mono or MP3 ≥ 128 kbps, one continuous take, no music |

Measure every file with `ffprobe` before uploading; after uploading, `probe_media` and `extract_frames`
(videos) or `view_images` (photos) show the studio's view. Fix with ffmpeg (recipes in the reference),
never by asking the user to install an editor.

## 4. Look before you use

- Look at a frame of every video and at every photo: what does it really show? The script and the
  concept names come from that, not from the file name.
- Nothing with real customer data, emails, credentials, license plates or other companies' brands. Ask
  before using photos with recognizable people.
- Before proposing the video, `view_images` on every image and `review_material` with an honest verdict
  per file (fits, doubtful, unfit) and the gaps; the proposal carries those warnings to the user. Skip
  both when the only image is the logo.

## 5. Free media

When the user has no material for a concept, offer to search free media and wait for the OK:

- Video and photos: `search_free_media` (Wikimedia Commons and the NASA library) with `kind` video or
  image, then `import_media` with the chosen `resultId`. It lands as support material and its credit is
  recorded in the project's credits file.
- Music: `search_free_music` with a mood that includes the kind of video ("calm tutorial", "upbeat
  product promo"), then `import_music`. Results come first from the brand's own bank, then Openverse
  (CC BY, CC0, public domain; never share-alike) and Wikimedia Commons.
- Material from a URL the user gives: download it outside the repo and `upload_asset` it; record its
  title, author, license and source with `write_project_text` in `work/credits.json`.
- Licenses: CC BY requires the credit in the publication's description; say so when delivering. Never
  use material whose license you could not confirm.

## 6. Recipes by goal

| The user has | Do |
| --- | --- |
| A screen recording of their own | normalize to 1080p30 silent (reference §2), `aroll`; script with `[m:ss]` marks; voice job; montage with `voice: "script"` and `subtle-lower` captions |
| A recording where they already speak | `aroll` with its audio; montage without `voice` (the speech is transcribed); pass the script text if they have it so captions spell names right |
| Photos and clips of their business, no main video | the best clip as `aroll` (or `photo-aroll` from photos), the rest as concept-named support; script repeating 2–4 concepts; preset `hardware` for an ad |
| Only a logo and some photos | a motion video is usually better: hand over to `video-maker-motion-brief` with the photos as images |
| Their own voice-over and a silent recording | the montage does not mix a loose voice-over: mux it onto the recording with ffmpeg (reference §2), upload the result as `aroll` and run the montage without `voice`; keep the original voice-over also as role `voice` |

After uploading, continue with the entry skill's footage steps.
