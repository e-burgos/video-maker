import { describe, expect, it } from 'vitest';

import { projectThroughHomography, screenHomography } from './screen-perspective';

describe('screenHomography', () => {
  const polygon: Array<[number, number]> = [[22.6, 9.9], [63.8, 12.1], [81.1, 86.2], [39.6, 89.3]];
  const height = 800;
  const aspect = 0.8078;
  const width = height * aspect;
  const corners = polygon.map(([x, y]) => [(x / 100) * width, (y / 100) * height]);

  it('maps the four corners of the screen box exactly onto the four corners of the device screen', () => {
    const screen = screenHomography(polygon, height, aspect);
    const boxCorners: Array<[number, number]> = [[0, 0], [screen.width, 0], [screen.width, screen.height], [0, screen.height]];
    boxCorners.forEach(([x, y], i) => {
      const [px, py] = projectThroughHomography(screen.matrix, x, y);
      expect(px).toBeCloseTo(corners[i]?.[0] ?? NaN, 2);
      expect(py).toBeCloseTo(corners[i]?.[1] ?? NaN, 2);
    });
  });

  it('sizes the box like the top and left edges of the screen and prints a column-major matrix3d', () => {
    const screen = screenHomography(polygon, height, aspect);
    expect(screen.width).toBeCloseTo(Math.hypot((corners[1]?.[0] ?? 0) - (corners[0]?.[0] ?? 0), (corners[1]?.[1] ?? 0) - (corners[0]?.[1] ?? 0)), 1);
    expect(screen.css).toMatch(/^matrix3d\((-?\d+(\.\d+)?(e-?\d+)?, ){15}-?\d+(\.\d+)?(e-?\d+)?\)$/u);
  });
});
