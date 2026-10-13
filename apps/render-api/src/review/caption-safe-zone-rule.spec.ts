import { describe, expect, it } from 'vitest';

import { captionSafeZoneFindings } from './caption-safe-zone-rule';
import type { CaptionLayoutFacts } from './review-inputs';

const CAPTION = { id: 'caption-1', startSec: 2, endSec: 4, text: 'Tocá el botón de ajustes', rect: { x: 600, y: 900, width: 700, height: 70 } };

function layout(overrides: Partial<CaptionLayoutFacts> = {}): CaptionLayoutFacts {
  return { captions: [CAPTION], logo: null, chatButton: null, overlays: [], ...overrides };
}

describe('captionSafeZoneFindings', () => {
  it('emits nothing without subtitles data', () => {
    expect(captionSafeZoneFindings(null)).toEqual([]);
    expect(captionSafeZoneFindings(layout({ captions: [] }))).toEqual([]);
  });

  it('emits nothing when nothing overlaps the subtitles', () => {
    const findings = captionSafeZoneFindings(layout({
      logo: { x: 96, y: 900, width: 200, height: 100 },
      chatButton: { x: 1747, y: 929, width: 173, height: 151 },
      overlays: [{ startSec: 0, endSec: 10, rect: { x: 1300, y: 60, width: 560, height: 315 } }],
    }));

    expect(findings).toEqual([]);
  });

  it('is critical when the logo overlaps a subtitle', () => {
    const [finding] = captionSafeZoneFindings(layout({ logo: { x: 500, y: 880, width: 200, height: 100 } }));

    expect(finding?.severity).toBe('critical');
    expect(finding?.message).toContain('isotipo');
    expect(finding?.timeRange).toEqual({ startSec: 2, endSec: 4 });
    expect(finding?.proposedFix).toContain('isotipo');
  });

  it('is critical when a subtitle reaches the chat button zone', () => {
    const [finding] = captionSafeZoneFindings(layout({
      captions: [{ ...CAPTION, rect: { x: 1300, y: 900, width: 600, height: 70 } }],
      chatButton: { x: 1747, y: 929, width: 173, height: 151 },
    }));

    expect(finding?.severity).toBe('critical');
    expect(finding?.message).toContain('botón de chat');
  });

  it('is critical when an overlay box covers a subtitle while both are visible', () => {
    const overlapping = { startSec: 3, endSec: 8, rect: { x: 900, y: 850, width: 600, height: 200 } };

    const [finding] = captionSafeZoneFindings(layout({ overlays: [overlapping] }));

    expect(finding?.message).toContain('recuadro');
    expect(finding?.proposedFix).toContain('60 px');
  });

  it('ignores an overlay box that is not on screen at the same time', () => {
    const later = { startSec: 6, endSec: 8, rect: { x: 900, y: 850, width: 600, height: 200 } };

    expect(captionSafeZoneFindings(layout({ overlays: [later] }))).toEqual([]);
  });

  it('reports the first affected subtitle', () => {
    const second = { ...CAPTION, id: 'caption-2', startSec: 5, endSec: 6 };
    const [finding] = captionSafeZoneFindings(layout({
      captions: [{ ...CAPTION, rect: { x: 0, y: 0, width: 10, height: 10 } }, second],
      logo: { x: 600, y: 900, width: 100, height: 100 },
    }));

    expect(finding?.timeRange).toEqual({ startSec: 5, endSec: 6 });
  });
});
