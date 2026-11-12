# Motion storyboard reference

Generated from libs/motion-graphics/src/storyboard/motion-storyboard.schema.ts — do not edit by hand; run `pnpm nx run plugin-references:plugin-references`.

Machine-readable schema: `schemas/motion-storyboard.schema.json`.

| Field | Type | Required | Allowed values | Default | Applies to | Description |
| --- | --- | --- | --- | --- | --- | --- |
| `version` | const 1 | yes | `1` |  |  |  |
| `title` | string | yes |  |  |  |  |
| `brand` | string (pattern ^[a-z][a-z0-9-]*$) | yes |  |  |  |  |
| `format` | enum | yes | `16:9`, `9:16` |  |  |  |
| `beatSync` | boolean | yes |  |  |  |  |
| `music` | object \| null | yes |  |  |  |  |
| `music.track` | string | yes |  |  |  |  |
| `music.volume` | number (min 0.05, max 1) | no |  |  |  | Legacy music level; the real level is calibrated automatically (about -27 LUFS without voice, 14.5 dB lower under the voice) and this value does not change it |
| `music.mode` | enum | no | `bed`, `segments` |  |  | bed (default): the music runs under the voice, ducked while it speaks. segments: the music plays full in the intro, the outro and the voice-free gaps of 2 s or more, with 0.6 s fades, and drops to a very low floor while the voice speaks |
| `music.floorDb` | number (min -60, max -6) | no |  |  |  | Only with mode segments: dB below the full music level while the voice speaks; default -30 |
| `voice` | object | no |  |  |  |  |
| `voice.id` | string | yes |  |  |  |  |
| `voice.lengthScale` | number (min 0.7, max 1.4) | yes |  |  |  |  |
| `scenes` | object[] (minItems 2, maxItems 16) | yes |  |  |  |  |
| `scenes[].id` | string (pattern ^[a-z][a-z0-9-]*$) | yes |  |  |  |  |
| `scenes[].chapter` | string | no |  |  |  |  |
| `scenes[].vo` | string | yes |  |  |  | Exact voice-over line for this scene, spoken in the target language |
| `scenes[].minBars` | number (max 16) | no |  |  |  |  |
| `scenes[].minSec` | number (max 60) | no |  |  |  | Minimum scene length in seconds, kept with or without beat sync and never cutting the voice; use it for scenes that carry several visual steps |
| `scenes[].anchor` | const drop \| number (min 0) | no | `drop` |  |  |  |
| `scenes[].direction` | object | no |  |  |  | How this voice-over line is delivered: pace, energy, pause after the line and words to stress. Omit it for the voice default |
| `scenes[].direction.intent` | string (maxLength 240) | no |  |  |  | Free-text delivery intent, e.g. "reassuring, closing the idea". |
| `scenes[].direction.pace` | enum | no | `slow`, `normal`, `fast` |  |  | slow stretches the line 12%, fast shortens it 8%; normal leaves the voice pace untouched. |
| `scenes[].direction.energy` | enum | no | `calm`, `neutral`, `lively` |  |  | calm lowers the prosody variation of the voice, lively raises it; neutral leaves the model defaults. |
| `scenes[].direction.pauseAfterMs` | integer (min 0, max 2000) | no |  |  |  | Silence appended after the line. |
| `scenes[].direction.emphasis` | string[] (maxItems 8) | no |  |  |  | Words to stress; recorded for engines that support it, ignored by Piper. |
| `scenes[].titleStyle` | enum | no | `split-chars`, `split-words`, `split-lines`, `mask-up`, `scramble` |  |  | How the scene headline enters: by letter, word or line, rising out of a mask, or scrambled. Omit it and the studio rotates it, never repeating the two previous scenes |
| `scenes[].exit` | enum | no | `blur-up`, `slide-left`, `scale-down`, `wipe`, `iris`, `drop` |  |  | How the scene leaves the frame. Never repeat the exit of the previous scene; use wipe, iris or slide-left before a new chapter. Omit it and the studio rotates exits on its own; the last scene always fades out |
| `scenes[].kind` | const hook / const problem / const brand-reveal / const feature / const remote-update / const schedule / const dashboard / const ai-generate / const context / const suggestion / const product / const gallery / const step / const connections / const ui-walkthrough / const do-dont / const cta | yes | `hook`, `problem`, `brand-reveal`, `feature`, `remote-update`, `schedule`, `dashboard`, `ai-generate`, `context`, `suggestion`, `product`, `gallery`, `step`, `connections`, `ui-walkthrough`, `do-dont`, `cta` |  |  |  |
| `scenes[].props` | object | yes |  |  |  |  |
| `scenes[].props.lines` | object[] (minItems 1, maxItems 2) | yes |  |  | `kind=hook` |  |
| `scenes[].props.lines[].title` | string | yes |  |  | `kind=hook` |  |
| `scenes[].props.lines[].accent` | string | no |  |  | `kind=hook` | Words shown right AFTER the title (or tagline) in the accent gradient; never repeat words of the title |
| `scenes[].props.lines[].cue` | string | no |  |  | `kind=hook` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.screen` | object | no |  |  | `kind=hook` |  |
| `scenes[].props.screen.kicker` | string | no |  |  | `kind=hook` |  |
| `scenes[].props.screen.text` | string | yes |  |  | `kind=hook` |  |
| `scenes[].props.screen.stamp` | string | no |  |  | `kind=hook` |  |
| `scenes[].props.screen.offCue` | string | no |  |  | `kind=hook` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.screen.stampCue` | string | no |  |  | `kind=hook` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.kicker` | string | no |  |  | `kind=problem`, `kind=feature`, `kind=product` |  |
| `scenes[].props.items` | object[] (minItems 2, maxItems 4) | yes |  |  | `kind=problem` |  |
| `scenes[].props.items[].icon` | enum | yes | `alert`, `bell`, `box`, `cable`, `calendar`, `chart`, `check`, `clock`, `cloud`, `dollar`, `image`, `lock`, `message`, `monitor-off`, `phone`, `pin`, `play`, `plug`, `router`, `shield`, `signal`, `sparkles`, `sun`, `trending-up`, `tv`, `usb`, `users`, `wifi`, `wifi-off`, `x`, `zap` |  | `kind=problem` |  |
| `scenes[].props.items[].label` | string | yes |  |  | `kind=problem` |  |
| `scenes[].props.items[].cue` | string | no |  |  | `kind=problem` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.strike` | boolean | yes |  |  | `kind=problem` |  |
| `scenes[].props.tagline` | string | no |  |  | `kind=brand-reveal`, `kind=cta` |  |
| `scenes[].props.accent` | string | no |  |  | `kind=brand-reveal`, `kind=feature`, `kind=remote-update`, `kind=schedule`, `kind=dashboard`, `kind=ai-generate`, `kind=context`, `kind=suggestion`, `kind=product`, `kind=step`, `kind=connections`, `kind=ui-walkthrough`, `kind=do-dont`, `kind=cta` | Words shown right AFTER the title (or tagline) in the accent gradient; never repeat words of the title |
| `scenes[].props.chips` | string[] (maxItems 3) / object[] (minItems 1, maxItems 4) / object[] (maxItems 4) | no |  |  | `kind=brand-reveal`, `kind=context`, `kind=step` |  |
| `scenes[].props.title` | string | no |  |  | `kind=feature`, `kind=remote-update`, `kind=schedule`, `kind=dashboard`, `kind=ai-generate`, `kind=context`, `kind=step`, `kind=connections`, `kind=ui-walkthrough`, `kind=do-dont` |  |
| `scenes[].props.text` | string | no |  |  | `kind=feature`, `kind=suggestion`, `kind=product`, `kind=step` |  |
| `scenes[].props.bullets` | object[] (maxItems 5) | yes |  |  | `kind=feature` |  |
| `scenes[].props.bullets[].text` | string | yes |  |  | `kind=feature` |  |
| `scenes[].props.bullets[].icon` | enum | no | `alert`, `bell`, `box`, `cable`, `calendar`, `chart`, `check`, `clock`, `cloud`, `dollar`, `image`, `lock`, `message`, `monitor-off`, `phone`, `pin`, `play`, `plug`, `router`, `shield`, `signal`, `sparkles`, `sun`, `trending-up`, `tv`, `usb`, `users`, `wifi`, `wifi-off`, `x`, `zap` |  | `kind=feature` |  |
| `scenes[].props.bullets[].tone` | enum | no | `ok`, `no`, `warn` |  | `kind=feature` |  |
| `scenes[].props.bullets[].cue` | string | no |  |  | `kind=feature` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.visual` | object | no |  |  | `kind=feature`, `kind=product`, `kind=step` |  |
| `scenes[].props.visual.kind` | const image / const device / const phone / const tablet / const tv / const icon / const countdown / const timer / const devices / const animation | yes | `image`, `device`, `phone`, `tablet`, `tv`, `icon`, `countdown`, `timer`, `devices`, `animation` |  |  |  |
| `scenes[].props.visual.src` | string | yes |  |  | `kind=image` | Project image path like images/photo.jpg, or brand asset like brand:counter-15 |
| `scenes[].props.visual.device` | string | yes |  |  | `kind=device` |  |
| `scenes[].props.visual.states` | object[] (minItems 1, maxItems 4) | no |  |  | `kind=device`, `kind=phone`, `kind=tablet`, `kind=tv` |  |
| `scenes[].props.visual.states[].screen` | object | yes |  |  | `kind=device`, `kind=phone`, `kind=tablet`, `kind=tv` |  |
| `scenes[].props.visual.states[].screen.type` | const promo / const list / const url / const status / const boot / const off / const image | yes | `promo`, `list`, `url`, `status`, `boot`, `off`, `image` |  |  |  |
| `scenes[].props.visual.states[].screen.kicker` | string | no |  |  | `type=promo` |  |
| `scenes[].props.visual.states[].screen.big` | string | yes |  |  | `type=promo` |  |
| `scenes[].props.visual.states[].screen.small` | string | no |  |  | `type=promo` |  |
| `scenes[].props.visual.states[].screen.tone` | enum | no | `sky`, `teal`, `warm`, `zinc` |  | `type=promo` |  |
| `scenes[].props.visual.states[].screen.title` | string | yes |  |  | `type=list`, `type=status` |  |
| `scenes[].props.visual.states[].screen.sub` | string | no |  |  | `type=list` |  |
| `scenes[].props.visual.states[].screen.items` | string[] (minItems 1, maxItems 5) | yes |  |  | `type=list` |  |
| `scenes[].props.visual.states[].screen.select` | integer (min 0) | no |  |  | `type=list` |  |
| `scenes[].props.visual.states[].screen.field` | string | no |  |  | `type=list` |  |
| `scenes[].props.visual.states[].screen.button` | string | no |  |  | `type=list` |  |
| `scenes[].props.visual.states[].screen.url` | string | yes |  |  | `type=url` |  |
| `scenes[].props.visual.states[].screen.toggle` | string | no |  |  | `type=url` |  |
| `scenes[].props.visual.states[].screen.status` | string | yes |  |  | `type=status` |  |
| `scenes[].props.visual.states[].screen.ok` | boolean | no |  |  | `type=status` |  |
| `scenes[].props.visual.states[].screen.text` | string | no |  |  | `type=off` |  |
| `scenes[].props.visual.states[].screen.src` | string | yes |  |  | `type=image` | Project image path like images/photo.jpg, or brand asset like brand:counter-15 |
| `scenes[].props.visual.states[].screen.scroll` | boolean | no |  |  | `type=image` | Scroll the capture from its top to its bottom during the scene; use a full-page capture |
| `scenes[].props.visual.states[].cue` | string | no |  |  | `kind=device`, `kind=phone`, `kind=tablet`, `kind=tv` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.visual.icon` | enum | no | `alert`, `bell`, `box`, `cable`, `calendar`, `chart`, `check`, `clock`, `cloud`, `dollar`, `image`, `lock`, `message`, `monitor-off`, `phone`, `pin`, `play`, `plug`, `router`, `shield`, `signal`, `sparkles`, `sun`, `trending-up`, `tv`, `usb`, `users`, `wifi`, `wifi-off`, `x`, `zap` |  | `kind=icon`, `kind=countdown` |  |
| `scenes[].props.visual.seconds` | integer (min 2, max 30) | yes |  |  | `kind=countdown` |  |
| `scenes[].props.visual.cue` | string | no |  |  | `kind=countdown`, `kind=timer`, `kind=animation` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.visual.labels` | string[] (minItems 2, maxItems 6) | yes |  |  | `kind=timer` |  |
| `scenes[].props.visual.caption` | string | no |  |  | `kind=timer` |  |
| `scenes[].props.visual.images` | any[] (minItems 3, maxItems 3) | yes |  |  | `kind=devices` | Full-page captures of the same site for [desktop monitor, tablet, phone] |
| `scenes[].props.visual.scroll` | boolean | no |  |  | `kind=devices` | Scroll each capture inside its frame during the scene |
| `scenes[].props.visual.name` | enum | yes | `delivery`, `payment`, `orders`, `secure-cloud`, `domain`, `publish` |  | `kind=animation` | Animated illustration: delivery (a van reaching the store pin), payment (a payment landing in the account), orders (cards moving across status columns), secure-cloud (a padlock closing on a cloud), domain (an address typed in a browser bar), publish (a draft switching to published) |
| `scenes[].props.campaign` | object | yes |  |  | `kind=remote-update` |  |
| `scenes[].props.campaign.name` | string | yes |  |  | `kind=remote-update` |  |
| `scenes[].props.campaign.meta` | string | no |  |  | `kind=remote-update` |  |
| `scenes[].props.campaign.badge` | string | yes |  |  | `kind=remote-update` |  |
| `scenes[].props.publishCue` | string | no |  |  | `kind=remote-update` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.screens` | object[] (minItems 1, maxItems 3) | yes |  |  | `kind=remote-update` |  |
| `scenes[].props.screens[].label` | string | yes |  |  | `kind=remote-update` |  |
| `scenes[].props.screens[].before` | string | yes |  |  | `kind=remote-update` |  |
| `scenes[].props.screens[].after` | string | yes |  |  | `kind=remote-update` |  |
| `scenes[].props.screens[].kicker` | string | no |  |  | `kind=remote-update` |  |
| `scenes[].props.axis` | object | yes |  |  | `kind=schedule` |  |
| `scenes[].props.axis.from` | integer (min 0, max 23) | yes |  |  | `kind=schedule` |  |
| `scenes[].props.axis.to` | integer (min 1, max 24) | yes |  |  | `kind=schedule` |  |
| `scenes[].props.days` | object | no |  |  | `kind=schedule` |  |
| `scenes[].props.days.on` | string[] (maxItems 7) | yes |  |  | `kind=schedule` |  |
| `scenes[].props.days.highlight` | string[] (maxItems 7) | no |  |  | `kind=schedule` |  |
| `scenes[].props.days.cue` | string | no |  |  | `kind=schedule` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.blocks` | object[] (minItems 1, maxItems 6) | yes |  |  | `kind=schedule` |  |
| `scenes[].props.blocks[].label` | string | yes |  |  | `kind=schedule` |  |
| `scenes[].props.blocks[].start` | number (min 0, max 24) | yes |  |  | `kind=schedule` |  |
| `scenes[].props.blocks[].end` | number (min 0, max 24) | yes |  |  | `kind=schedule` |  |
| `scenes[].props.blocks[].row` | enum | no | `0`, `1` |  | `kind=schedule` |  |
| `scenes[].props.blocks[].tone` | enum | no | `sky`, `teal`, `warm`, `zinc` |  | `kind=schedule` |  |
| `scenes[].props.blocks[].cue` | string | no |  |  | `kind=schedule` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.tags` | object[] (maxItems 3) | no |  |  | `kind=schedule` |  |
| `scenes[].props.tags[].text` | string | yes |  |  | `kind=schedule` |  |
| `scenes[].props.tags[].cue` | string | no |  |  | `kind=schedule` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.rows` | object[] (minItems 1, maxItems 5) | yes |  |  | `kind=dashboard` |  |
| `scenes[].props.rows[].name` | string | yes |  |  | `kind=dashboard` |  |
| `scenes[].props.rows[].place` | string | yes |  |  | `kind=dashboard` |  |
| `scenes[].props.rows[].now` | string | yes |  |  | `kind=dashboard` |  |
| `scenes[].props.stat` | object | yes |  |  | `kind=dashboard` |  |
| `scenes[].props.stat.label` | string | yes |  |  | `kind=dashboard` |  |
| `scenes[].props.stat.value` | integer (min 0) | yes |  |  | `kind=dashboard` |  |
| `scenes[].props.stat.total` | integer | no |  |  | `kind=dashboard` |  |
| `scenes[].props.stat.cue` | string | no |  |  | `kind=dashboard` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.alert` | object | no |  |  | `kind=dashboard` |  |
| `scenes[].props.alert.row` | integer (min 0) | yes |  |  | `kind=dashboard` |  |
| `scenes[].props.alert.title` | string | yes |  |  | `kind=dashboard` |  |
| `scenes[].props.alert.detail` | string | yes |  |  | `kind=dashboard` |  |
| `scenes[].props.alert.cue` | string | no |  |  | `kind=dashboard` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.label` | string | no |  |  | `kind=ai-generate`, `kind=suggestion`, `kind=step` |  |
| `scenes[].props.prompt` | string | yes |  |  | `kind=ai-generate` |  |
| `scenes[].props.result` | object | yes |  |  | `kind=ai-generate` |  |
| `scenes[].props.result.image` | string | yes |  |  | `kind=ai-generate` | Project image path like images/photo.jpg, or brand asset like brand:counter-15 |
| `scenes[].props.result.kicker` | string | no |  |  | `kind=ai-generate` |  |
| `scenes[].props.result.big` | string | yes |  |  | `kind=ai-generate` |  |
| `scenes[].props.result.small` | string | no |  |  | `kind=ai-generate` |  |
| `scenes[].props.result.tone` | enum | no | `sky`, `teal`, `warm`, `zinc` |  | `kind=ai-generate` |  |
| `scenes[].props.badge` | string | no |  |  | `kind=ai-generate` |  |
| `scenes[].props.resultCue` | string | no |  |  | `kind=ai-generate` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.chips[].text` | string | yes |  |  | `kind=context`, `kind=step` |  |
| `scenes[].props.chips[].icon` | enum | no | `alert`, `bell`, `box`, `cable`, `calendar`, `chart`, `check`, `clock`, `cloud`, `dollar`, `image`, `lock`, `message`, `monitor-off`, `phone`, `pin`, `play`, `plug`, `router`, `shield`, `signal`, `sparkles`, `sun`, `trending-up`, `tv`, `usb`, `users`, `wifi`, `wifi-off`, `x`, `zap` |  | `kind=context`, `kind=step` |  |
| `scenes[].props.chips[].tone` | enum | no | `ok`, `no`, `warn` |  | `kind=context`, `kind=step` |  |
| `scenes[].props.chips[].cue` | string | no |  |  | `kind=context`, `kind=step` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.radar` | object | no |  |  | `kind=context` |  |
| `scenes[].props.radar.label` | string | yes |  |  | `kind=context` |  |
| `scenes[].props.radar.pins` | integer (min 0, max 6) | yes |  |  | `kind=context` |  |
| `scenes[].props.radar.cue` | string | no |  |  | `kind=context` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.action` | string | yes |  |  | `kind=suggestion` |  |
| `scenes[].props.done` | string | yes |  |  | `kind=suggestion` |  |
| `scenes[].props.actionCue` | string | no |  |  | `kind=suggestion` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.name` | string | yes |  |  | `kind=product` |  |
| `scenes[].props.specs` | string[] (maxItems 4) | no |  |  | `kind=product` |  |
| `scenes[].props.textCue` | string | no |  |  | `kind=product` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.images` | string[] (minItems 2, maxItems 4) | yes |  |  | `kind=gallery` |  |
| `scenes[].props.caption` | string | no |  |  | `kind=gallery` |  |
| `scenes[].props.n` | integer | no |  |  | `kind=step` |  |
| `scenes[].props.device` | string | yes |  |  | `kind=connections` | Device id from the brand manifest |
| `scenes[].props.links` | object[] (minItems 1, maxItems 3) | yes |  |  | `kind=connections` |  |
| `scenes[].props.links[].to` | enum | yes | `tv`, `router`, `power`, `phone` |  | `kind=connections` |  |
| `scenes[].props.links[].label` | string | yes |  |  | `kind=connections` |  |
| `scenes[].props.links[].cue` | string | no |  |  | `kind=connections` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.tv` | object[] (minItems 1, maxItems 4) | no |  |  | `kind=connections` |  |
| `scenes[].props.tv[].screen` | object | yes |  |  | `kind=connections` |  |
| `scenes[].props.tv[].screen.type` | const promo / const list / const url / const status / const boot / const off / const image | yes | `promo`, `list`, `url`, `status`, `boot`, `off`, `image` |  |  |  |
| `scenes[].props.tv[].screen.kicker` | string | no |  |  | `type=promo` |  |
| `scenes[].props.tv[].screen.big` | string | yes |  |  | `type=promo` |  |
| `scenes[].props.tv[].screen.small` | string | no |  |  | `type=promo` |  |
| `scenes[].props.tv[].screen.tone` | enum | no | `sky`, `teal`, `warm`, `zinc` |  | `type=promo` |  |
| `scenes[].props.tv[].screen.title` | string | yes |  |  | `type=list`, `type=status` |  |
| `scenes[].props.tv[].screen.sub` | string | no |  |  | `type=list` |  |
| `scenes[].props.tv[].screen.items` | string[] (minItems 1, maxItems 5) | yes |  |  | `type=list` |  |
| `scenes[].props.tv[].screen.select` | integer (min 0) | no |  |  | `type=list` |  |
| `scenes[].props.tv[].screen.field` | string | no |  |  | `type=list` |  |
| `scenes[].props.tv[].screen.button` | string | no |  |  | `type=list` |  |
| `scenes[].props.tv[].screen.url` | string | yes |  |  | `type=url` |  |
| `scenes[].props.tv[].screen.toggle` | string | no |  |  | `type=url` |  |
| `scenes[].props.tv[].screen.status` | string | yes |  |  | `type=status` |  |
| `scenes[].props.tv[].screen.ok` | boolean | no |  |  | `type=status` |  |
| `scenes[].props.tv[].screen.text` | string | no |  |  | `type=off` |  |
| `scenes[].props.tv[].screen.src` | string | yes |  |  | `type=image` | Project image path like images/photo.jpg, or brand asset like brand:counter-15 |
| `scenes[].props.tv[].screen.scroll` | boolean | no |  |  | `type=image` | Scroll the capture from its top to its bottom during the scene; use a full-page capture |
| `scenes[].props.tv[].cue` | string | no |  |  | `kind=connections` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.image` | string | yes |  |  | `kind=ui-walkthrough` | Capture of the interface: project image path or brand asset. All step coordinates are fractions of this image |
| `scenes[].props.frame` | enum | no | `browser`, `phone`, `none` |  | `kind=ui-walkthrough` | Frame around the capture; default browser |
| `scenes[].props.url` | string | no |  |  | `kind=ui-walkthrough`, `kind=cta` | Address shown in the browser bar; only with frame browser |
| `scenes[].props.boxes` | object[] (maxItems 40) | no |  |  | `kind=ui-walkthrough` | Measured boxes of the capture, copied from the brief image; steps point at them by name with box |
| `scenes[].props.boxes[].name` | string | yes |  |  | `kind=ui-walkthrough` | Name of the region as the dev gave it, e.g. "Tarjeta Plan Propio" |
| `scenes[].props.boxes[].x` | number (min 0, max 1) | yes |  |  | `kind=ui-walkthrough` | Left edge as a fraction of the image width |
| `scenes[].props.boxes[].y` | number (min 0, max 1) | yes |  |  | `kind=ui-walkthrough` | Top edge as a fraction of the image height |
| `scenes[].props.boxes[].w` | number (max 1) | yes |  |  | `kind=ui-walkthrough` | Width as a fraction of the image width |
| `scenes[].props.boxes[].h` | number (max 1) | yes |  |  | `kind=ui-walkthrough` | Height as a fraction of the image height |
| `scenes[].props.boxes[].source` | enum | no | `given`, `measured` | `given` | `kind=ui-walkthrough` | given: the dev provided it; measured: the producer measured it on the capture |
| `scenes[].props.boxes[].measuredBy` | string | no |  |  | `kind=ui-walkthrough` | Who measured the box, only when source is measured |
| `scenes[].props.boxes[].measuredAt` | string | no |  |  | `kind=ui-walkthrough` | ISO instant of the measurement, only when source is measured |
| `scenes[].props.autoZoom` | boolean | no |  |  | `kind=ui-walkthrough` | The studio camera follows the steps (zooms into each one and pans between them) when the scene has no zoom step; set false to keep the full capture in view |
| `scenes[].props.steps` | object[] (minItems 1, maxItems 8) | yes |  |  | `kind=ui-walkthrough` |  |
| `scenes[].props.steps[].action` | enum | yes | `move`, `click`, `type`, `highlight`, `callout`, `zoom` |  | `kind=ui-walkthrough` | move: cursor travels to x,y. click: cursor clicks at x,y. type: text is typed inside the field box. highlight: outlines the box. callout: speech bubble with text anchored at x,y. zoom: magnifies the region and returns |
| `scenes[].props.steps[].box` | string | no |  |  | `kind=ui-walkthrough` | Name of a measured box of the capture (see boxes). Use it instead of x,y,w,h whenever the brief gives the box: move, click and callout go to its center, type, highlight and zoom cover it |
| `scenes[].props.steps[].x` | number (min 0, max 1) | no |  |  | `kind=ui-walkthrough` | Horizontal position over the capture, 0 = left edge, 1 = right edge. For boxes (type, highlight, zoom) it is the left edge of the box. Omit when box is set |
| `scenes[].props.steps[].y` | number (min 0, max 1) | no |  |  | `kind=ui-walkthrough` | Vertical position over the capture, 0 = top edge, 1 = bottom edge. For boxes it is the top edge of the box. Omit when box is set |
| `scenes[].props.steps[].w` | number (max 1) | no |  |  | `kind=ui-walkthrough` | Box width as a fraction of the capture width (type, highlight, zoom) |
| `scenes[].props.steps[].h` | number (max 1) | no |  |  | `kind=ui-walkthrough` | Box height as a fraction of the capture height (type, highlight, zoom) |
| `scenes[].props.steps[].text` | string | no |  |  | `kind=ui-walkthrough` | Required for type (the text typed) and callout (the bubble text) |
| `scenes[].props.steps[].cue` | string | no |  |  | `kind=ui-walkthrough` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.steps[].at` | number (min 0) | no |  |  | `kind=ui-walkthrough` | Seconds from the scene start when the step happens; used only when there is no cue |
| `scenes[].props.bad` | object | yes |  |  | `kind=do-dont` |  |
| `scenes[].props.bad.title` | string | yes |  |  | `kind=do-dont` |  |
| `scenes[].props.bad.items` | string[] (minItems 1, maxItems 3) | yes |  |  | `kind=do-dont` |  |
| `scenes[].props.bad.cue` | string | no |  |  | `kind=do-dont` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.good` | object | yes |  |  | `kind=do-dont` |  |
| `scenes[].props.good.title` | string | yes |  |  | `kind=do-dont` |  |
| `scenes[].props.good.items` | string[] (minItems 1, maxItems 3) | yes |  |  | `kind=do-dont` |  |
| `scenes[].props.good.cue` | string | no |  |  | `kind=do-dont` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
| `scenes[].props.button` | string | yes |  |  | `kind=cta` |  |
| `scenes[].props.buttonCue` | string | no |  |  | `kind=cta` | Prefix of a word spoken in this scene voice line; the element appears when the voice says it |
