# Material specs and recipes

## 1. Output formats

| Format id | Where | Resolution | fps | Safe zone kept free of captions and logo |
| --- | --- | --- | --- | --- |
| `youtube-16x9` | YouTube, web, help center, sales calls | 1920×1080 | 30 | 60 px on every side |
| `reels-9x16` · `tiktok-9x16` · `shorts-9x16` | Instagram, TikTok, YouTube Shorts | 1080×1920 | 30 | 220 top, 400 bottom, 60 left, 140 right |

The three vertical ids render the same today; pick the network's one to record the intent. Always pass
the format to the montage: the studio's default is vertical. The A-roll is fitted with "cover" (fills the
frame and crops the rest), so its orientation must match.

## 2. ffmpeg recipes

Normalize a recording to 16:9, silent, 30 fps (for a generated voice):

```bash
ffmpeg -y -i capture.mov -an -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart main.mp4
```

For 9:16 replace `1920:1080` with `1080:1920`. To keep the user's voice, drop `-an` and add
`-c:a aac -b:a 160k -ar 48000`.

Cut a support clip (15 s from 0:12, silent):

```bash
ffmpeg -y -ss 12 -t 15 -i capture.mov -an -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" \
  -c:v libx264 -crf 20 -pix_fmt yuv420p shelves.mp4
```

Mux the user's voice-over onto a silent recording (the video is cut to the voice):

```bash
ffmpeg -y -i main.mp4 -i voiceover.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 160k -ar 48000 -shortest main-with-voice.mp4
```

Loop music that is shorter than the video: `ffmpeg -stream_loop 3 -i short.mp3 -c copy music.mp3`.

Convert HEIC or GIF photos: `ffmpeg -i photo.heic -q:v 2 photo.jpg`.

Check alpha of a logo: `ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 logo.png`.

Measure everything at once:

```bash
for f in *.mp4 *.mov *.jpg *.png *.mp3 *.wav; do [ -e "$f" ] && ffprobe -v error \
  -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt:format=duration -of compact "$f"; done
```

## 3. How support material is matched to the narration

The montage counts the words of the narration (lowercase, accents removed, ñ → n, punctuation removed).
Words that repeat at least the preset's minimum, have the minimum length and are not stopwords become
**concepts**. Each support file name is split into tokens by `-`, `_`, spaces and dots; numeric tokens are
ignored. A file is a candidate for a concept when one of its tokens is exactly that concept; among
candidates the one with fewer tokens wins.

| Preset | Use it for | Minimum repeats | Minimum word length | Support style |
| --- | --- | --- | --- | --- |
| `software-demo` | software tutorials, dynamic reels | 3 | 4 | full screen, 1.2–4 s, up to 35 % |
| `educational` | explanations, calm tutorials, sober ads | 4 | 5 | picture-in-picture, prefers photos, up to 20 % |
| `recipe` | step by step with many shots | 2 | 4 | full screen, 0.9–3.5 s, up to 55 % |
| `hardware` | physical products, ads | 3 | 4 | full screen, 1.5–5 s, up to 45 %, music more present |

So: choose 2–4 one-word concepts, repeat them in the script as the preset needs, name the files with that
word. `shelves.mp4` and `shelves-2.mp4` both serve "shelves"; `shelves-counter.mp4` serves both words but
loses against single-token files.

## 4. Timed scripts

A script line may start with `[m:ss]` (or `[m:ss-m:ss]` for a window): the voice job places it at that
time of the A-roll. With at least one mark the video lasts the whole A-roll; without marks it lasts
`min(voice, A-roll)`. At ~2.5 words per second, a line must fit before the next mark; the voice job
reports overflowing lines.

## 5. Caption styles

| Style | For |
| --- | --- |
| `subtle-lower` | tutorials, recorded UIs, long YouTube videos (the only one that never covers an interface) |
| `bold-impact` | reels, shorts, ads: 1–3 words, centered |
| `clean-sans` | like bold-impact without uppercase |
| `outline-pop` | light or busy backgrounds |
| `brand` | the brand's own caption theme |
| `off` | no captions |

## 6. Credits file

`work/credits.json`, written with `write_project_text` when material is not imported by the studio's
search tools:

```json
{
  "assets": [
    {
      "role": "music",
      "file": "raw/audio/theme.mp3",
      "title": "Track title",
      "artist": "Author",
      "source": "https://example.org/track",
      "license": "CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "attribution": "Track title by Author, CC BY 4.0"
    }
  ]
}
```

## 7. Frequent mistakes

| Delivered | Symptom | Fix |
| --- | --- | --- |
| horizontal recording for a vertical video | UI cropped at the sides | record vertically, or make it 16:9 |
| support clip named by what it shows (`screen-01.mp4`) | it never appears | name it by a concept of the script |
| concept said twice with `educational` | not detected | repeat it 4 times, or use `software-demo` |
| music shorter than the video | the montage fails | loop it |
| logo without alpha | a box over the video | transparent PNG or SVG in the brand |
| silent A-roll and no voice job | no captions, silent video | voice job first, then montage with `voice: "script"` |
| svg, gif or heic files | ignored | convert to jpg or png |
