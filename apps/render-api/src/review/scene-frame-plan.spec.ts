import { describe, expect, it } from 'vitest';

import { countNamedElements, sceneFrameCount, sceneFrameTimes } from './scene-frame-plan';

describe('countNamedElements', () => {
  it.each([
    [null, 0],
    ['Abrí el panel y elegí la opción', 0],
    ['Mirá el Easy Pro en la pared', 1],
    ['Con el Easy Pro y el Counter 15 contás todo', 2],
    ['Easy Pro cuenta personas', 1],
    ['Ventas, stock y pedidos en una sola vista', 3],
    ['Entrás y salís', 0],
  ])('counts %s as %s', (voice, expected) => {
    expect(countNamedElements(voice)).toBe(expected);
  });
});

describe('sceneFrameCount', () => {
  it('uses one frame for a short scene naming at most one thing', () => {
    expect(sceneFrameCount(6, 'Mirá el Easy Pro')).toBe(1);
    expect(sceneFrameCount(3, null)).toBe(1);
  });

  it('uses one frame every 3 s, between 2 and 5, for a long scene', () => {
    expect(sceneFrameCount(7, null)).toBe(3);
    expect(sceneFrameCount(6.5, null)).toBe(3);
    expect(sceneFrameCount(30, null)).toBe(5);
  });

  it('uses at least two frames when a short scene names several things', () => {
    expect(sceneFrameCount(4, 'El Easy Pro y el Counter 15')).toBe(2);
    expect(sceneFrameCount(4, 'Ventas, stock, pedidos, clientes y cajas')).toBe(5);
  });
});

describe('sceneFrameTimes', () => {
  it('centers a single frame and spreads several evenly inside the scene', () => {
    expect(sceneFrameTimes(4, 10, null)).toEqual([7]);
    expect(sceneFrameTimes(0, 9, null)).toEqual([1.5, 4.5, 7.5]);
  });
});
