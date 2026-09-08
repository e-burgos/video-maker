import { describe, expect, it } from 'vitest';
import { CAPTION_PRESETS } from './caption-preset';
import { captionBlockStyle, captionClipAnimation } from './caption-animation';
import type { CaptionClipAnimationInput } from './caption-animation';

const FPS = 30;
const DURATION_IN_FRAMES = 45;

const POP_PRESET = CAPTION_PRESETS['bold-impact'];
const RISE_PRESET = CAPTION_PRESETS['clean-sans'];
const FADE_PRESET = CAPTION_PRESETS['subtle-lower'];

function animateAt(frame: number, overrides: Partial<CaptionClipAnimationInput> = {}) {
  return captionClipAnimation({
    frame,
    durationInFrames: DURATION_IN_FRAMES,
    fps: FPS,
    preset: POP_PRESET,
    ...overrides,
  });
}

describe('captionClipAnimation', () => {
  it('en frame 0 la opacidad arranca por debajo de 1 y, en modo pop, la escala también (CA-006)', () => {
    const animation = animateAt(0);

    expect(animation.opacity).toBeLessThan(1);
    expect(animation.scale).toBeLessThan(1);
  });

  it('pasada la duración de entrada del preset, llega a opacidad y escala plenas (CA-006)', () => {
    const animation = animateAt(POP_PRESET.animation.enterDurationFrames + 1);

    expect(animation.opacity).toBe(1);
    expect(animation.scale).toBe(1);
  });

  it('se mantiene en meseta (opacidad y escala plenas) durante todo el tramo intermedio', () => {
    const midFrame = Math.floor(DURATION_IN_FRAMES / 2);
    const animation = animateAt(midFrame);

    expect(animation.opacity).toBe(1);
    expect(animation.scale).toBe(1);
  });

  it('vuelve a bajar en el último frame, simétrico a la entrada (RN-2)', () => {
    const firstFrame = animateAt(0);
    const lastFrame = animateAt(DURATION_IN_FRAMES - 1);

    expect(lastFrame.opacity).toBeLessThan(1);
    expect(lastFrame.opacity).toBe(firstFrame.opacity);
    expect(lastFrame.scale).toBe(firstFrame.scale);
  });

  it('dos llamadas con el mismo frame devuelven exactamente el mismo resultado (determinismo, RN-4)', () => {
    const first = animateAt(3);
    const second = animateAt(3);

    expect(second).toEqual(first);
  });

  it('el transform siempre combina translateY y scale, sin excepciones', () => {
    const animation = animateAt(0);

    expect(animation.transform).toBe(
      `translateY(${animation.translateYEm}em) scale(${animation.scale})`,
    );
  });

  describe('modo pop', () => {
    it('anima la escala y no desplaza verticalmente', () => {
      const entering = captionClipAnimation({
        frame: 0,
        durationInFrames: DURATION_IN_FRAMES,
        fps: FPS,
        preset: POP_PRESET,
      });
      const settled = captionClipAnimation({
        frame: POP_PRESET.animation.enterDurationFrames + 1,
        durationInFrames: DURATION_IN_FRAMES,
        fps: FPS,
        preset: POP_PRESET,
      });

      expect(entering.scale).not.toBe(1);
      expect(settled.scale).toBe(1);
      expect(entering.translateYEm).toBe(0);
      expect(settled.translateYEm).toBe(0);
    });
  });

  describe('modo rise', () => {
    it('anima translateYEm y no cambia la escala', () => {
      const entering = captionClipAnimation({
        frame: 0,
        durationInFrames: DURATION_IN_FRAMES,
        fps: FPS,
        preset: RISE_PRESET,
      });
      const settled = captionClipAnimation({
        frame: RISE_PRESET.animation.enterDurationFrames + 1,
        durationInFrames: DURATION_IN_FRAMES,
        fps: FPS,
        preset: RISE_PRESET,
      });

      expect(entering.translateYEm).not.toBe(0);
      expect(settled.translateYEm).toBe(0);
      expect(entering.scale).toBe(1);
      expect(settled.scale).toBe(1);
    });
  });

  describe('modo fade', () => {
    it('solo anima la opacidad: escala y translateYEm quedan fijos en todo el clip', () => {
      for (let frame = 0; frame < DURATION_IN_FRAMES; frame += 1) {
        const animation = captionClipAnimation({
          frame,
          durationInFrames: DURATION_IN_FRAMES,
          fps: FPS,
          preset: FADE_PRESET,
        });

        expect(animation.scale).toBe(1);
        expect(animation.translateYEm).toBe(0);
      }
    });
  });

  describe('R-12: clips de 1 a 3 frames', () => {
    it.each([1, 2, 3])(
      'degrada de forma controlada y determinista con durationInFrames=%i',
      (durationInFrames) => {
        for (let frame = 0; frame < durationInFrames; frame += 1) {
          const animation = captionClipAnimation({
            frame,
            durationInFrames,
            fps: FPS,
            preset: POP_PRESET,
          });

          expect(animation.opacity).toBeGreaterThanOrEqual(0);
          expect(animation.opacity).toBeLessThanOrEqual(1);
          expect(Number.isFinite(animation.scale)).toBe(true);
          expect(Number.isFinite(animation.translateYEm)).toBe(true);
        }
      },
    );

    it('un clip de un único frame queda casi transparente (progress = -1)', () => {
      const animation = captionClipAnimation({
        frame: 0,
        durationInFrames: 1,
        fps: FPS,
        preset: POP_PRESET,
      });

      expect(animation.opacity).toBe(0);
    });
  });
});

describe('captionBlockStyle', () => {
  it('devuelve siempre las mismas claves sin condicionales, tomando opacity y transform de la animación', () => {
    const animation = captionClipAnimation({
      frame: 0,
      durationInFrames: DURATION_IN_FRAMES,
      fps: FPS,
      preset: POP_PRESET,
    });

    const style = captionBlockStyle(animation, POP_PRESET);

    expect(style).toEqual({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      columnGap: `${POP_PRESET.wordGapEm}em`,
      maxWidth: '100%',
      opacity: animation.opacity,
      transform: animation.transform,
      transformOrigin: '50% 50%',
    });
  });
});
