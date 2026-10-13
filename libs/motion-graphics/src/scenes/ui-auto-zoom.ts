export interface UnitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CameraFocus {
  scale: number;
  cx: number;
  cy: number;
}

export const POINT_RADIUS = 0.03;
export const FOCUS_PADDING = 0.08;
export const MIN_FOCUS_SIDE = 0.45;
export const FULL_VIEW_FROM_SIDE = 0.85;
export const SHARED_KEYFRAME_OVERLAP = 0.6;
export const SHARED_KEYFRAME_MAX_SCALE_RATIO = 1.25;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const FULL_VIEW: CameraFocus = { scale: 1, cx: 0.5, cy: 0.5 };

export function pointRect(x: number, y: number, radius = POINT_RADIUS): UnitRect {
  return { x: x - radius, y: y - radius, w: radius * 2, h: radius * 2 };
}

export function unionRects(rects: readonly UnitRect[]): UnitRect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function padRect(rect: UnitRect, padding = FOCUS_PADDING): UnitRect {
  const left = clamp(rect.x - padding, 0, 1);
  const top = clamp(rect.y - padding, 0, 1);
  const right = clamp(rect.x + rect.w + padding, 0, 1);
  const bottom = clamp(rect.y + rect.h + padding, 0, 1);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function focusOn(rect: UnitRect): CameraFocus {
  const padded = padRect(rect);
  const side = Math.max(padded.w, padded.h, MIN_FOCUS_SIDE);
  if (side >= FULL_VIEW_FROM_SIDE) return FULL_VIEW;
  return {
    scale: 1 / side,
    cx: clamp(padded.x + padded.w / 2, side / 2, 1 - side / 2),
    cy: clamp(padded.y + padded.h / 2, side / 2, 1 - side / 2),
  };
}

export function focusWindow(focus: CameraFocus): UnitRect {
  const side = 1 / focus.scale;
  return { x: focus.cx - side / 2, y: focus.cy - side / 2, w: side, h: side };
}

export function windowOverlap(a: CameraFocus, b: CameraFocus): number {
  const wa = focusWindow(a);
  const wb = focusWindow(b);
  const width = Math.min(wa.x + wa.w, wb.x + wb.w) - Math.max(wa.x, wb.x);
  const height = Math.min(wa.y + wa.h, wb.y + wb.h) - Math.max(wa.y, wb.y);
  if (width <= 0 || height <= 0) return 0;
  return (width * height) / Math.min(wa.w * wa.h, wb.w * wb.h);
}

const isFullView = (focus: CameraFocus): boolean => focus.scale === 1;

function sharesKeyframe(a: CameraFocus, b: CameraFocus): boolean {
  if (isFullView(a) !== isFullView(b)) return false;
  if (Math.max(a.scale, b.scale) / Math.min(a.scale, b.scale) > SHARED_KEYFRAME_MAX_SCALE_RATIO) return false;
  return windowOverlap(a, b) >= SHARED_KEYFRAME_OVERLAP;
}

export function cameraKeyframes(rects: readonly UnitRect[]): CameraFocus[] {
  const keyframes: CameraFocus[] = [];
  let group: UnitRect[] = [];
  let groupFocus: CameraFocus | null = null;
  const flush = (): void => {
    if (groupFocus !== null) for (let i = 0; i < group.length; i += 1) keyframes.push(groupFocus);
    group = [];
    groupFocus = null;
  };
  for (const rect of rects) {
    const own = focusOn(rect);
    if (groupFocus !== null && sharesKeyframe(groupFocus, own)) {
      const merged = focusOn(unionRects([...group, rect]) ?? rect);
      if (isFullView(merged) === isFullView(own)) {
        group.push(rect);
        groupFocus = merged;
        continue;
      }
    }
    flush();
    group = [rect];
    groupFocus = own;
  }
  flush();
  return keyframes;
}
