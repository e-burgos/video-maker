# Timeline reference

Generated from libs/timeline-core/src/schemas — do not edit by hand; run `pnpm nx run plugin-references:plugin-references`.

Machine-readable schema: `schemas/timeline.schema.json`.

| Field | Type | Required | Allowed values | Default | Applies to | Description |
| --- | --- | --- | --- | --- | --- | --- |
| `schemaVersion` | const 1 | yes | `1` |  |  |  |
| `id` | string | yes |  |  |  |  |
| `format` | object | yes |  |  |  |  |
| `format.preset` | enum | yes | `reels-9x16`, `tiktok-9x16`, `shorts-9x16`, `youtube-16x9` |  |  |  |
| `format.width` | integer (min 240) | yes |  |  |  |  |
| `format.height` | integer (min 240) | yes |  |  |  |  |
| `format.fps` | enum | yes | `24`, `25`, `30`, `50`, `60` |  |  |  |
| `durationFrames` | integer (min 1) | yes |  |  |  |  |
| `assets` | object[] | yes |  |  |  |  |
| `assets[].id` | string | yes |  |  |  |  |
| `assets[].kind` | enum | yes | `video`, `image`, `audio` |  |  |  |
| `assets[].path` | string | yes |  |  |  |  |
| `assets[].durationMs` | integer (min 0) | yes |  |  |  |  |
| `assets[].fps` | number | no |  |  |  |  |
| `assets[].width` | integer (min 1) | no |  |  |  |  |
| `assets[].height` | integer (min 1) | no |  |  |  |  |
| `assets[].rotation` | enum | no | `0`, `90`, `180`, `270` |  |  |  |
| `assets[].hasAudio` | boolean | no |  |  |  |  |
| `assets[].hasAlpha` | boolean | no |  |  |  |  |
| `assets[].audio` | object | no |  |  |  |  |
| `assets[].audio.sampleRate` | integer | yes |  |  |  |  |
| `assets[].audio.channels` | integer (min 1) | yes |  |  |  |  |
| `assets[].audio.codec` | string | no |  |  |  |  |
| `assets[].audio.integratedLufs` | number | no |  |  |  |  |
| `assets[].videoCodec` | string | no |  |  |  |  |
| `assets[].probedAt` | string | yes |  |  |  |  |
| `tracks` | object | yes |  |  |  |  |
| `tracks.aroll` | object[] | yes |  |  |  |  |
| `tracks.aroll[].id` | string | yes |  |  |  |  |
| `tracks.aroll[].assetId` | string | yes |  |  |  |  |
| `tracks.aroll[].from` | integer (min 0) | yes |  |  |  |  |
| `tracks.aroll[].durationFrames` | integer (min 1) | yes |  |  |  |  |
| `tracks.aroll[].trimStartMs` | integer (min 0) | yes |  |  |  |  |
| `tracks.aroll[].fit` | enum | no | `cover`, `contain`, `pip` |  |  |  |
| `tracks.aroll[].transform` | object | yes |  |  |  |  |
| `tracks.aroll[].transform.scale` | number | yes |  |  |  |  |
| `tracks.aroll[].transform.translateX` | number | yes |  |  |  |  |
| `tracks.aroll[].transform.translateY` | number | yes |  |  |  |  |
| `tracks.aroll[].transform.anchor` | enum | no | `center`, `top`, `face-hint` |  |  |  |
| `tracks.aroll[].muted` | boolean | no |  |  |  |  |
| `tracks.broll` | object[] | yes |  |  |  |  |
| `tracks.broll[].id` | string | yes |  |  |  |  |
| `tracks.broll[].assetId` | string | yes |  |  |  |  |
| `tracks.broll[].from` | integer (min 0) | yes |  |  |  |  |
| `tracks.broll[].durationFrames` | integer (min 1) | yes |  |  |  |  |
| `tracks.broll[].trimStartMs` | integer (min 0) | yes |  |  |  |  |
| `tracks.broll[].fit` | enum | no | `cover`, `contain`, `pip` |  |  |  |
| `tracks.broll[].transform` | object | yes |  |  |  |  |
| `tracks.broll[].transform.scale` | number | yes |  |  |  |  |
| `tracks.broll[].transform.translateX` | number | yes |  |  |  |  |
| `tracks.broll[].transform.translateY` | number | yes |  |  |  |  |
| `tracks.broll[].transform.anchor` | enum | no | `center`, `top`, `face-hint` |  |  |  |
| `tracks.broll[].muted` | boolean | no |  |  |  |  |
| `tracks.voice` | object[] | yes |  |  |  |  |
| `tracks.voice[].id` | string | yes |  |  |  |  |
| `tracks.voice[].assetId` | string | yes |  |  |  |  |
| `tracks.voice[].from` | integer (min 0) | yes |  |  |  |  |
| `tracks.voice[].durationFrames` | integer (min 1) | yes |  |  |  |  |
| `tracks.voice[].trimStartMs` | integer (min 0) | yes |  |  |  |  |
| `tracks.voice[].gainDb` | number | yes |  |  |  |  |
| `tracks.voice[].fadeInFrames` | integer (min 0) | no |  |  |  |  |
| `tracks.voice[].fadeOutFrames` | integer (min 0) | no |  |  |  |  |
| `tracks.music` | object[] | yes |  |  |  |  |
| `tracks.music[].id` | string | yes |  |  |  |  |
| `tracks.music[].assetId` | string | yes |  |  |  |  |
| `tracks.music[].from` | integer (min 0) | yes |  |  |  |  |
| `tracks.music[].durationFrames` | integer (min 1) | yes |  |  |  |  |
| `tracks.music[].trimStartMs` | integer (min 0) | yes |  |  |  |  |
| `tracks.music[].gainDb` | number | yes |  |  |  |  |
| `tracks.music[].fadeInFrames` | integer (min 0) | no |  |  |  |  |
| `tracks.music[].fadeOutFrames` | integer (min 0) | no |  |  |  |  |
| `tracks.captions` | object[] | yes |  |  |  |  |
| `tracks.captions[].id` | string | yes |  |  |  |  |
| `tracks.captions[].from` | integer (min 0) | yes |  |  |  |  |
| `tracks.captions[].durationFrames` | integer (min 1) | yes |  |  |  |  |
| `tracks.captions[].words` | object[] (minItems 1, maxItems 10) | yes |  |  |  |  |
| `tracks.captions[].words[].text` | string | yes |  |  |  |  |
| `tracks.captions[].words[].fromFrame` | integer (min 0) | yes |  |  |  |  |
| `tracks.captions[].words[].durationFrames` | integer (min 1) | yes |  |  |  |  |
| `tracks.captions[].emphasisIndex` | integer (min 0) | no |  |  |  |  |
| `tracks.captions[].box` | object | no |  |  |  |  |
| `tracks.captions[].box.x` | integer (min 0) | yes |  |  |  |  |
| `tracks.captions[].box.y` | integer (min 0) | yes |  |  |  |  |
| `tracks.captions[].box.width` | integer (min 0) | yes |  |  |  |  |
| `tracks.captions[].box.height` | integer (min 0) | yes |  |  |  |  |
| `transitions` | object[] | no |  |  |  |  |
| `transitions[].betweenClipIds` | string[] (minItems 2, maxItems 2) | yes |  |  |  |  |
| `transitions[].kind` | enum | yes | `fade`, `slide`, `whip-pan`, `light-leak`, `wipe`, `flip`, `clock-wipe`, `iris` |  |  |  |
| `transitions[].direction` | enum | no | `from-left`, `from-right`, `from-top`, `from-bottom` |  |  |  |
| `transitions[].durationFrames` | integer (min 1) | yes |  |  |  |  |
| `transitions[].timing` | object | yes |  |  |  |  |
| `transitions[].timing.type` | const linear / const spring | yes | `linear`, `spring` |  |  |  |
| `transitions[].timing.damping` | number | yes |  |  | `type=spring` |  |
| `transitions[].timing.stiffness` | number | yes |  |  | `type=spring` |  |
| `transitions[].timing.mass` | number | yes |  |  | `type=spring` |  |
| `audioMix` | object | yes |  |  |  |  |
| `audioMix.voice` | object | yes |  |  |  |  |
| `audioMix.voice.integratedLufs` | number | yes |  | `-14` |  |  |
| `audioMix.voice.truePeakDbtp` | number | yes |  | `-1` |  |  |
| `audioMix.voice.loudnessRange` | number | yes |  | `11` |  |  |
| `audioMix.music` | object | yes |  |  |  |  |
| `audioMix.music.baseGainDb` | number | yes |  | `-12` |  |  |
| `audioMix.music.duckedGainDb` | number | yes |  | `-24` |  |  |
| `audioMix.music.referenceLufs` | number (max 0) | yes |  | `-16` |  |  |
| `audioMix.music.attackMs` | integer | yes |  | `150` |  |  |
| `audioMix.music.releaseMs` | integer | yes |  | `400` |  |  |
| `audioMix.music.holdMs` | integer | yes |  | `250` |  |  |
| `audioMix.music.mode` | enum | no | `bed`, `segments` |  |  | segments: music plays full in the intro, the outro and the voice-free gaps of 2 s or more and drops to duckedGainDb while someone speaks; absent means the continuous bed. |
| `audioMix.automation` | object[] | yes |  |  |  |  |
| `audioMix.automation[].frame` | integer (min 0) | yes |  |  |  |  |
| `audioMix.automation[].gainDb` | number | yes |  |  |  |  |
| `logo` | object | no |  |  |  |  |
| `logo.assetId` | string | yes |  |  |  |  |
| `logo.position` | enum | yes | `bottom-right`, `bottom-left`, `top-right`, `top-left` | `bottom-right` |  |  |
| `logo.widthRatio` | number (max 1) | yes |  | `0.32` |  |  |
| `logo.marginRatio` | number (min 0, max 0.5) | yes |  | `0.035` |  |  |
| `logo.opacity` | number (max 1) | yes |  | `1` |  |  |
| `bumpers` | object | no |  |  |  |  |
| `bumpers.intro` | object | no |  |  |  |  |
| `bumpers.intro.enabled` | boolean | yes |  | `false` |  |  |
| `bumpers.intro.durationMs` | integer (min 500, max 6000) | yes |  | `2000` |  |  |
| `bumpers.intro.backgroundColor` | string (pattern ^#[0-9a-fA-F]{6}$) | yes |  | `#ffffff` |  |  |
| `bumpers.intro.animation` | enum | yes | `fade`, `zoom`, `slide-up` | `zoom` |  |  |
| `bumpers.intro.logoWidthRatio` | number (max 1) | yes |  | `0.4` |  |  |
| `bumpers.intro.logoAssetId` | string | no |  |  |  |  |
| `bumpers.intro.background` | enum | no | `solid`, `gradient`, `noise`, `shapes`, `glow` |  |  |  |
| `bumpers.intro.reveal` | enum | no | `fade`, `zoom`, `slide-up`, `wipe`, `blur-in`, `pop` |  |  |  |
| `bumpers.intro.accentColor` | string (pattern ^#[0-9a-fA-F]{6}$) | no |  |  |  |  |
| `bumpers.intro.caption` | string (maxLength 60) | no |  |  |  |  |
| `bumpers.intro.sfxKind` | enum | no | `whoosh`, `impact`, `shimmer`, `click`, `none` |  |  | Leave it out: the bumper already sounds by itself, following its logo reveal. Set it only when the user names a sound (whoosh, impact, shimmer, click) or asks for silence (none). |
| `bumpers.intro.sfx` | object[] (maxItems 6) | no |  |  |  | Explicit sound cues with a sound bank id; leave it out unless the user asks for an exact sound at an exact moment. |
| `bumpers.intro.sfx[].atMs` | integer (min 0) | yes |  |  |  |  |
| `bumpers.intro.sfx[].assetId` | string | yes |  |  |  |  |
| `bumpers.intro.sfx[].gainDb` | number (max 0) | yes |  |  |  |  |
| `bumpers.intro.sfx[].fadeInMs` | integer (min 0) | no |  |  |  |  |
| `bumpers.intro.sfx[].fadeOutMs` | integer (min 0) | no |  |  |  |  |
| `bumpers.outro` | object | no |  |  |  |  |
| `bumpers.outro.enabled` | boolean | yes |  | `false` |  |  |
| `bumpers.outro.durationMs` | integer (min 500, max 6000) | yes |  | `2000` |  |  |
| `bumpers.outro.backgroundColor` | string (pattern ^#[0-9a-fA-F]{6}$) | yes |  | `#ffffff` |  |  |
| `bumpers.outro.animation` | enum | yes | `fade`, `zoom`, `slide-up` | `zoom` |  |  |
| `bumpers.outro.logoWidthRatio` | number (max 1) | yes |  | `0.4` |  |  |
| `bumpers.outro.logoAssetId` | string | no |  |  |  |  |
| `bumpers.outro.background` | enum | no | `solid`, `gradient`, `noise`, `shapes`, `glow` |  |  |  |
| `bumpers.outro.reveal` | enum | no | `fade`, `zoom`, `slide-up`, `wipe`, `blur-in`, `pop` |  |  |  |
| `bumpers.outro.accentColor` | string (pattern ^#[0-9a-fA-F]{6}$) | no |  |  |  |  |
| `bumpers.outro.caption` | string (maxLength 60) | no |  |  |  |  |
| `bumpers.outro.sfxKind` | enum | no | `whoosh`, `impact`, `shimmer`, `click`, `none` |  |  | Leave it out: the bumper already sounds by itself, following its logo reveal. Set it only when the user names a sound (whoosh, impact, shimmer, click) or asks for silence (none). |
| `bumpers.outro.sfx` | object[] (maxItems 6) | no |  |  |  | Explicit sound cues with a sound bank id; leave it out unless the user asks for an exact sound at an exact moment. |
| `bumpers.outro.sfx[].atMs` | integer (min 0) | yes |  |  |  |  |
| `bumpers.outro.sfx[].assetId` | string | yes |  |  |  |  |
| `bumpers.outro.sfx[].gainDb` | number (max 0) | yes |  |  |  |  |
| `bumpers.outro.sfx[].fadeInMs` | integer (min 0) | no |  |  |  |  |
| `bumpers.outro.sfx[].fadeOutMs` | integer (min 0) | no |  |  |  |  |
| `bumpers.style` | object | no |  |  |  |  |
| `bumpers.style.rotate` | boolean | yes |  |  |  |  |
| `bumpers.style.seed` | integer (min 0) | no |  |  |  |  |
| `bumpers.style.backgrounds` | enum[] (minItems 1) | no | `solid`, `gradient`, `noise`, `shapes`, `glow` |  |  |  |
| `bumpers.style.reveals` | enum[] (minItems 1) | no | `fade`, `zoom`, `slide-up`, `wipe`, `blur-in`, `pop` |  |  |  |
| `bumpers.style.accentColor` | string (pattern ^#[0-9a-fA-F]{6}$) | no |  |  |  |  |
| `bumpers.style.secondaryColor` | string (pattern ^#[0-9a-fA-F]{6}$) | no |  |  |  |  |
| `bumpers.style.outroCaption` | string (maxLength 60) | no |  |  |  |  |
| `safeZone` | object | no |  |  |  |  |
| `safeZone.top` | integer | yes |  |  |  |  |
| `safeZone.bottom` | integer | yes |  |  |  |  |
| `safeZone.left` | integer | yes |  |  |  |  |
| `safeZone.right` | integer | yes |  |  |  |  |
| `captionStyle` | enum | no | `bold-impact`, `clean-sans`, `outline-pop`, `subtle-lower`, `brand`, `off` |  |  |  |
| `captionTheme` | object | no |  |  |  |  |
| `captionTheme.fontFamily` | string | yes |  |  |  |  |
| `captionTheme.fontFiles` | object[] (minItems 1) | yes |  |  |  |  |
| `captionTheme.fontFiles[].path` | string | yes |  |  |  |  |
| `captionTheme.fontFiles[].weight` | string | no |  |  |  |  |
| `captionTheme.fontFiles[].unicodeRange` | string | no |  |  |  |  |
| `captionTheme.textColor` | string (pattern ^#[0-9a-fA-F]{6}$) | yes |  |  |  |  |
| `captionTheme.accentColor` | string (pattern ^#[0-9a-fA-F]{6}$) | yes |  |  |  |  |
| `captionTheme.boxColor` | string (pattern ^#[0-9a-fA-F]{6}$) | yes |  |  |  |  |
| `delivery` | object | no |  |  |  |  |
| `delivery.kind` | enum | yes | `tutorial`, `motion`, `short` |  |  |  |
| `delivery.requiresVoice` | boolean | no |  |  |  |  |
| `delivery.requiresCaptions` | boolean | no |  |  |  |  |
| `delivery.maxDurationSec` | number | no |  |  |  |  |
| `delivery.format` | string | no |  |  |  |  |
| `textOverlays` | object[] (maxItems 40) | no |  |  |  |  |
| `textOverlays[].id` | string | yes |  |  |  |  |
| `textOverlays[].kind` | enum | yes | `lower-third`, `chapter-title`, `kinetic-text` |  |  | lower-third: a name or topic with a short line under it; chapter-title: the title of a new section, with an optional number; kinetic-text: one short phrase that enters word by word. |
| `textOverlays[].startMs` | integer (min 0) | yes |  |  |  | Start on the final timeline, in ms from the first frame after the intro bumper. |
| `textOverlays[].durationMs` | integer (min 1200, max 10000) | yes |  |  |  |  |
| `textOverlays[].text` | string (maxLength 70) | yes |  |  |  |  |
| `textOverlays[].subtitle` | string (maxLength 70) | no |  |  |  | Second line of a lower-third or chapter-title; ignored by kinetic-text. |
| `textOverlays[].eyebrow` | string (maxLength 12) | no |  |  |  | Small label over a chapter-title, such as its number ("01"); ignored by the other kinds. |
| `textOverlays[].variant` | enum | no | `slide-underline`, `accent-bar`, `plate-wipe`, `blur-rise`, `mask-wipe`, `word-stagger`, `word-rise`, `word-pop`, `word-blur` |  |  | Leave it out: the studio rotates the animation so two overlays of the same kind never enter alike. Set it only when the user asks for a specific look. |
| `textOverlays[].placement` | enum | no | `bottom-left`, `bottom-right`, `top-left`, `top-right`, `top-center`, `bottom-center` |  |  | Leave it out: each kind goes to a screen margin that keeps the recorded interface visible. |
