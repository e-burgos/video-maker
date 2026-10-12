import { boxCenter } from './image-box';
import type { ImageBox } from './image-box';
import type { WalkthroughStepSpec } from './motion-storyboard.schema';

export type ResolvedWalkthroughStep = Omit<WalkthroughStepSpec, 'box' | 'x' | 'y'> & { x: number; y: number };

const AREA_ACTIONS: ReadonlySet<string> = new Set(['type', 'highlight', 'zoom']);

export function findBox(boxes: readonly ImageBox[] | undefined, name: string): ImageBox | undefined {
  return boxes?.find((box) => box.name === name);
}

export function resolveWalkthroughStep(step: WalkthroughStepSpec, boxes: readonly ImageBox[] | undefined): ResolvedWalkthroughStep | null {
  const { box: boxName, x, y, ...rest } = step;
  if (boxName === undefined) return x === undefined || y === undefined ? null : { ...rest, x, y };
  const box = findBox(boxes, boxName);
  if (box === undefined) return null;
  if (AREA_ACTIONS.has(step.action)) return { ...rest, x: box.x, y: box.y, w: box.w, h: box.h };
  return { ...rest, ...boxCenter(box) };
}
