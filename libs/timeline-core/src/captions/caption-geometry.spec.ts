import { describe, expect, it } from 'vitest';

import { captionTextRect, pipRect } from './caption-geometry';

const FRAME = { width: 1920, height: 1080 };
const SAFE_ZONE = { top: 60, bottom: 60, left: 60, right: 60 };

describe('captionTextRect', () => {
  it('centers a lower subtitle horizontally near the bottom of the frame', () => {
    const rect = captionTextRect(['Hola', 'mundo'], null, 'subtle-lower', FRAME, SAFE_ZONE);

    expect(rect.x + rect.width / 2).toBeCloseTo(960, 0);
    expect(rect.y).toBeGreaterThan(900);
  });

  it('falls back to the default style for unknown styles', () => {
    expect(captionTextRect(['Hola'], null, null, FRAME, SAFE_ZONE)).toEqual(
      captionTextRect(['Hola'], null, 'bold-impact', FRAME, SAFE_ZONE),
    );
  });
});

describe('pipRect', () => {
  it('anchors a 32 percent wide box 5 percent from the bottom-right corner', () => {
    expect(pipRect(FRAME, 16 / 9)).toEqual({ x: 1210, y: 639, width: 614, height: 345 });
  });
});
