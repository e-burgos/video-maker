import { describe, expect, it } from 'vitest';
import {
  LOGO_BUMPER_ZOOM_FROM,
  logoBumperEnterFrames,
  logoBumperExitFrames,
  logoBumperLogoStyle,
} from './logo-bumper-style';

const FPS = 30;
const TWO_SECONDS = 60;

function styleAt(frame: number, animation: 'fade' | 'zoom' | 'slide-up' = 'zoom') {
  return logoBumperLogoStyle({ animation, frame, fps: FPS, durationInFrames: TWO_SECONDS });
}

describe('logoBumperLogoStyle', () => {
  it('a 30 fps entra en 18 frames (600 ms) y sale en 9 (300 ms)', () => {
    expect(logoBumperEnterFrames(FPS, TWO_SECONDS)).toBe(18);
    expect(logoBumperExitFrames(FPS, TWO_SECONDS)).toBe(9);
  });

  it('arranca invisible y llega a opacidad plena al terminar la entrada', () => {
    expect(styleAt(0).opacity).toBe(0);
    expect(styleAt(18).opacity).toBe(1);
  });

  it('se mantiene pleno entre la entrada y la salida', () => {
    expect(styleAt(30).opacity).toBe(1);
    expect(styleAt(TWO_SECONDS - 9).opacity).toBe(1);
  });

  it('sale con fade en los últimos 300 ms', () => {
    expect(styleAt(TWO_SECONDS - 5).opacity).toBeLessThan(1);
    expect(styleAt(TWO_SECONDS - 5).opacity).toBeGreaterThan(0);
    expect(styleAt(TWO_SECONDS).opacity).toBe(0);
  });

  it('zoom escala desde el factor inicial hasta 1', () => {
    expect(styleAt(0, 'zoom').transform).toBe(`scale(${LOGO_BUMPER_ZOOM_FROM})`);
    expect(styleAt(18, 'zoom').transform).toBe('scale(1)');
  });

  it('slide-up entra desplazado desde abajo y termina en su lugar', () => {
    expect(styleAt(0, 'slide-up').transform).toBe('translateY(12%)');
    expect(styleAt(18, 'slide-up').transform).toBe('translateY(0%)');
  });

  it('fade no transforma el logo', () => {
    expect(styleAt(0, 'fade').transform).toBe('none');
    expect(styleAt(18, 'fade').transform).toBe('none');
  });

  it('con un bumper cortísimo la entrada y la salida siguen cabiendo', () => {
    const shortBumper = { animation: 'zoom' as const, fps: FPS, durationInFrames: 15 };

    expect(logoBumperEnterFrames(FPS, 15) + logoBumperExitFrames(FPS, 15)).toBeLessThanOrEqual(15);
    expect(logoBumperLogoStyle({ ...shortBumper, frame: 0 }).opacity).toBe(0);
    expect(logoBumperLogoStyle({ ...shortBumper, frame: 15 }).opacity).toBe(0);
  });
});
