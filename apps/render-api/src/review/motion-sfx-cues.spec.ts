import { describe, expect, it } from 'vitest';

import { parseMotionSfxCues } from './motion-sfx-cues';

describe('parseMotionSfxCues', () => {
  it('reads sound-effect audio tags and ignores voice and music', () => {
    const html = `
      <audio id="vo-hook" src="assets/audio/vo-hook.wav" data-start="0" data-duration="3" data-volume="1"></audio>
      <audio id="sfx-whoosh-cta" src="assets/runtime/sfx/whoosh.mp3" data-start="4.72" data-duration="0.57" data-track-index="13" data-volume="0.35"></audio>
      <audio id="sfx-riser" src="assets/runtime/sfx/riser.mp3" data-start="1" data-duration="3.4" data-media-start="6.6" data-volume="0.55"></audio>`;

    expect(parseMotionSfxCues(html)).toEqual([
      { src: 'assets/runtime/sfx/whoosh.mp3', startSec: 4.72, endSec: 5.29, mediaStartSec: 0, volume: 0.35 },
      { src: 'assets/runtime/sfx/riser.mp3', startSec: 1, endSec: 4.4, mediaStartSec: 6.6, volume: 0.55 },
    ]);
  });
});
