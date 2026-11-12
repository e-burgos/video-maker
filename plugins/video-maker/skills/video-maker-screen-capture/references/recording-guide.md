# Recording guide

## Cost lessons

These rules took recorded tutorials from about three hours (rediscovering the UI run after run) to about
forty minutes and a single take.

1. **One rehearsal that walks the whole flow** and prints what each step found (`count()`, visible,
   texts). Run, read, fix everything, run once more.
2. **Read the UI code before the first rehearsal**, all at once: `aria-label`, `title`, button texts,
   stable test ids. Write the selectors once.
3. **Short timeouts in the rehearsal, and verify before the expensive action.** A blind click at the end of
   a flow that creates records cannot be repeated without creating them again. Verify the content (whose
   record opened), not only that something opened.
4. **Desktop and mobile are the same flow with another format.** Parametrize instead of copying.
5. **Review frames in one targeted extraction**: first frame, each risky milestone, last frame.
6. **The previous state defines the video.** Before recording, list the real state (records, media) and
   decide what is shown; note what was created and needs cleanup.
7. **Tutorials find bugs: budget for it.** Recording is the cheapest audit of a flow.

| Step | Target time |
| --- | --- |
| Map controls in the code and write the flow from the example | 15 min |
| One rehearsal and fixes | 10 min |
| Final take | video length + 2 min |
| Frames, upload, handover | 10 min |

## Traps already handled by the recorder

| Trap | Handled by |
| --- | --- |
| The session lives in `sessionStorage` and `storageState` does not keep it | the login context copies it and seeds it with an init script |
| An overlay (tour, banner) intercepts clicks | `onNavigate(page)` runs after every `goTo` |
| A target wider than the screen receives the click somewhere else | `click` aims inside the visible part; `preciseClick` delegates the click to Playwright |
| Visible text differs from the accessible name (CSS `uppercase`) | selectors with case-insensitive regexes |
| The cursor is not drawn in the recording | a synthetic cursor is injected and re-injected every 1.5 s |
| A slow server step leaves dead time on screen | `waitUntil(condition, { outputSeconds })` speeds that stretch up and moves later milestones |
| Mouse moves in straight lines at constant speed | Bézier paths with easing, slight overshoot on long moves |

## Re-doing one stretch

```js
import { joinTakes, writeTimedScript } from './record.mjs';

const first = { video: '/abs/take1/my-flow.mp4', to: 42.0, milestones: take1.milestones };
const second = { video: '/abs/take2/my-flow.mp4', from: 3.5, milestones: take2.milestones };
const joined = joinTakes({ takes: [first, second], output: '/abs/final/my-flow.mp4' });
writeTimedScript({ milestones: joined.milestones, narration, file: '/abs/final/script.txt' });
```

Milestones outside each take's range are dropped; the others shift to the joined timeline. Narration and
milestones must stay 1:1.

## Timing

- A line needs `words / 2.5 + 0.6` seconds; `lineWindow(n)` waits exactly that after the action.
- `VIDEO_MAKER_PACE=0.7` (or `config.pace`) shortens every reading pause without touching cursor speed,
  typing or the narration windows.
- Marks in `script.txt` refer to the final recording, after trimming and sped-up waits.

## When the studio reports a line that did not fit

The voice job reports lines whose sentence was longer than their window. Shorten that sentence, or add
`air()` after its action and record again. Do not ask the voice to speed up.
