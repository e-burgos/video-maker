export interface UnitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AutoZoomFocus {
  scale: number;
  cx: number;
  cy: number;
}

export type CalloutPlacementSide = { horizontal: 'start' | 'mid' | 'end'; vertical: 'above' | 'below' };

export const POINT_RADIUS = 0.03;
export const CAPTURE_PADDING = 0.07;
export const SKIP_WHEN_REGION_AT_LEAST = 0.7;
export const MIN_AUTO_SCALE = 1.15;
export const MAX_AUTO_SCALE = 2.2;
export const BUBBLE_MAX_WIDTH = 0.4;
export const BUBBLE_HEIGHT = 0.14;
export const BUBBLE_CHAR_WIDTH = 0.012;
export const BUBBLE_BASE_WIDTH = 0.08;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function pointRect(x: number, y: number, radius = POINT_RADIUS): UnitRect {
  return { x: x - radius, y: y - radius, w: radius * 2, h: radius * 2 };
}

export function calloutRect(x: number, y: number, text: string, placement: CalloutPlacementSide): UnitRect {
  const width = clamp(BUBBLE_BASE_WIDTH + text.length * BUBBLE_CHAR_WIDTH, 0.15, BUBBLE_MAX_WIDTH);
  const left = placement.horizontal === 'start' ? x : placement.horizontal === 'end' ? x - width : x - width / 2;
  const top = placement.vertical === 'above' ? y - BUBBLE_HEIGHT : y;
  return boundsOf([pointRect(x, y), { x: left, y: top, w: width, h: BUBBLE_HEIGHT }]);
}

function boundsOf(rects: readonly UnitRect[]): UnitRect {
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function unionRects(rects: readonly UnitRect[]): UnitRect | null {
  return rects.length === 0 ? null : boundsOf(rects);
}

export function padRect(rect: UnitRect, padding = CAPTURE_PADDING): UnitRect {
  const left = clamp(rect.x - padding, 0, 1);
  const top = clamp(rect.y - padding, 0, 1);
  const right = clamp(rect.x + rect.w + padding, 0, 1);
  const bottom = clamp(rect.y + rect.h + padding, 0, 1);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function squareAroundCenter(rect: UnitRect): { side: number; cx: number; cy: number } {
  const side = Math.max(rect.w, rect.h);
  return { side, cx: clamp(rect.x + rect.w / 2, side / 2, 1 - side / 2), cy: clamp(rect.y + rect.h / 2, side / 2, 1 - side / 2) };
}

export function autoZoomFocus(rects: readonly UnitRect[]): AutoZoomFocus | null {
  const union = unionRects(rects);
  if (union === null) return null;
  const { side, cx, cy } = squareAroundCenter(padRect(union));
  if (side >= SKIP_WHEN_REGION_AT_LEAST) return null;
  const scale = Math.min(1 / side, MAX_AUTO_SCALE);
  if (scale < MIN_AUTO_SCALE) return null;
  const window = 1 / scale;
  return { scale, cx: clamp(cx, window / 2, 1 - window / 2), cy: clamp(cy, window / 2, 1 - window / 2) };
}
