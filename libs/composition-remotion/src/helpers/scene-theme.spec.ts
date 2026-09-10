import type { OutputFormat } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { safeZoneFor } from '@video-maker/timeline-core';

import { captionBoxFor } from './caption-box';
import { captionPreset } from './caption-preset';
import { captionBandTop, sceneTheme } from './scene-theme';

const PORTRAIT: OutputFormat = { preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 };
const LANDSCAPE: OutputFormat = { preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 };

describe('sceneTheme', () => {
  it('scales the font size off the shorter side, so 9:16 and 16:9 keep the same type size', () => {
    expect(sceneTheme('title', PORTRAIT).fontSize).toBe(sceneTheme('title', LANDSCAPE).fontSize);
  });

  it('gives every role its own size, biggest for a title and smallest for code', () => {
    const title = sceneTheme('title', PORTRAIT).fontSize;
    const text = sceneTheme('text', PORTRAIT).fontSize;
    const code = sceneTheme('code', PORTRAIT).fontSize;

    expect(title).toBeGreaterThan(text);
    expect(text).toBeGreaterThan(code);
  });

  it('takes its palette and type family from the caption preset of spec-003', () => {
    const preset = captionPreset('outline-pop');
    const theme = sceneTheme('title', PORTRAIT, 'outline-pop');

    expect(theme.accent).toBe(preset.emphasisColor);
    expect(theme.color).toBe(preset.color);
    expect(theme.fontFamily).toBe(preset.fontFamily);
  });

  it('uppercases a title and leaves body copy as written', () => {
    expect(sceneTheme('title', PORTRAIT, 'bold-impact').textTransform).toBe('uppercase');
    expect(sceneTheme('text', PORTRAIT, 'bold-impact').textTransform).toBe('none');
  });

  it('loosens the line height for code only', () => {
    expect(sceneTheme('code', PORTRAIT).lineHeightEm).toBe(1.5);
    expect(sceneTheme('text', PORTRAIT).lineHeightEm).toBe(captionPreset().lineHeightEm);
  });

  it('derives the padding from each axis of the real format, not from the shorter side', () => {
    const landscape = sceneTheme('text', LANDSCAPE);

    expect(landscape.paddingX).toBe(Math.round(1920 * 0.09));
    expect(landscape.paddingY).toBe(Math.round(1080 * 0.08));
  });

  it('uses a monospace stack for code that never depends on a downloaded font', () => {
    expect(sceneTheme('code', PORTRAIT).monoFontFamily).toContain('monospace');
  });

  it('reserva la mitad baja del cuadro para que el texto de la escena no pise a las captions', () => {
    for (const format of [PORTRAIT, LANDSCAPE]) {
      const theme = sceneTheme('title', format);
      const contentBottom = format.height - theme.paddingBottom;
      const captionBox = captionBoxFor(safeZoneFor(format), format, captionPreset('bold-impact'));

      expect(theme.paddingBottom).toBe(format.height - captionBandTop(format));
      expect(contentBottom).toBe(captionBox.y);
      expect(contentBottom).toBeLessThan(format.height / 2 + 1);
    }
  });
});
