import { describe, expect, it } from 'vitest';
import {
  blurReveal,
  entryFade,
  entryPop,
  entrySlide,
  exitFade,
  lineGrowth,
  splitWords,
  staggerDelay,
  PLATE_REVEAL_FRAMES,
  plateReveal,
  TEXT_OVERLAY_EXIT_FRAMES,
} from './text-overlay-motion';

const FPS = 30;

describe('text overlay motion', () => {
  it('las entradas arrancan invisibles y terminan quietas', () => {
    expect(entryFade({ frame: 0, fps: FPS }).opacity).toBe(0);
    expect(entryFade({ frame: 60, fps: FPS }).opacity).toBeCloseTo(1, 2);
    expect(entrySlide({ frame: 0, fps: FPS, direction: 'left', distance: 16 }).transform).toBe('translateX(-16px)');
    expect(entrySlide({ frame: 60, fps: FPS, direction: 'right', distance: 16 }).transform).toMatch(/translateX\(0(\.\d+)?px\)/);
    expect(blurReveal({ frame: 0, fps: FPS, travelPx: 10, blurPx: 10 }).filter).toBe('blur(10px)');
    expect(entryPop({ frame: 60, fps: FPS, from: 0.5 }).transform).toMatch(/scale\(1(\.0+\d*)?\)|scale\(0\.99\d*\)/);
  });

  it('respetan el delay', () => {
    expect(entryFade({ frame: 5, fps: FPS, delay: 8 }).opacity).toBe(0);
    expect(lineGrowth({ frame: 7, fps: FPS, delay: 8 })).toBe(0);
    expect(lineGrowth({ frame: 60, fps: FPS, delay: 8 })).toBeCloseTo(100, 0);
  });

  it('la salida baja la opacidad solo en los últimos cuadros', () => {
    expect(exitFade(0, 90)).toBe(1);
    expect(exitFade(90 - TEXT_OVERLAY_EXIT_FRAMES, 90)).toBe(1);
    expect(exitFade(89, 90)).toBeLessThan(0.1);
    expect(exitFade(90, 90)).toBe(0);
  });

  it('parte palabras y escalona', () => {
    expect(splitWords('  hola   mundo ')).toEqual(['hola', 'mundo']);
    expect(staggerDelay(3)).toBe(12);
    expect(staggerDelay(-1)).toBe(0);
  });
});

describe('plateReveal', () => {
  it('abre la placa desde el lado del texto y termina sin recorte', () => {
    expect(plateReveal(0, 'left')).toBe('inset(0% 100% 0% 0%)');
    expect(plateReveal(0, 'right')).toBe('inset(0% 0% 0% 100%)');
    expect(plateReveal(0, 'center')).toBe('inset(0% 50% 0% 50%)');
    expect(plateReveal(PLATE_REVEAL_FRAMES, 'left')).toBe('inset(0% 0% 0% 0%)');
  });

  it('arranca despacio: a los tres cuadros la placa sigue casi cerrada', () => {
    const hidden = Number(/inset\(0% ([\d.]+)%/.exec(plateReveal(3, 'left'))?.[1]);
    expect(hidden).toBeGreaterThan(85);
  });
});
