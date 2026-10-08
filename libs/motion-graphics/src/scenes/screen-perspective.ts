export type Homography = [number, number, number, number, number, number, number, number, number];

export interface ScreenPerspective {
  width: number;
  height: number;
  matrix: Homography;
  css: string;
}

type Point = [number, number];

function unitSquareToQuad([p0, p1, p2, p3]: [Point, Point, Point, Point]): Homography {
  const [x0, y0] = p0;
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0, 1];
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

function scaleInput(m: Homography, width: number, height: number): Homography {
  return [m[0] / width, m[1] / height, m[2], m[3] / width, m[4] / height, m[5], m[6] / width, m[7] / height, m[8]];
}

function toMatrix3d(m: Homography): string {
  const columnMajor = [m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]];
  return `matrix3d(${columnMajor.map((value) => Number(value.toPrecision(8))).join(', ')})`;
}

export function projectThroughHomography(m: Homography, x: number, y: number): Point {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

export function screenHomography(polygonPercent: Array<[number, number]>, deviceHeight: number, aspect: number): ScreenPerspective {
  const deviceWidth = deviceHeight * aspect;
  const corners = polygonPercent.map(([x, y]): Point => [(x / 100) * deviceWidth, (y / 100) * deviceHeight]) as [Point, Point, Point, Point];
  const [topLeft, topRight, , bottomLeft] = corners;
  const width = Math.hypot(topRight[0] - topLeft[0], topRight[1] - topLeft[1]);
  const height = Math.hypot(bottomLeft[0] - topLeft[0], bottomLeft[1] - topLeft[1]);
  const matrix = scaleInput(unitSquareToQuad(corners), width, height);
  return { width, height, matrix, css: toMatrix3d(matrix) };
}
