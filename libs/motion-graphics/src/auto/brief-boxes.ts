import { describeMeasuredBox, isMeasuredBox } from '../storyboard/image-box';
import type { ImageBox } from '../storyboard/image-box';
import type { MotionStoryboard, MotionStoryboardScene, WalkthroughStepSpec } from '../storyboard/motion-storyboard.schema';
import { findBox } from '../storyboard/resolve-walkthrough-boxes';
import { briefImageRef } from './motion-brief';
import type { MotionBrief } from './motion-brief';
import type { StoryboardIssue } from './check-storyboard-against-brief';

export const BOX_MATCH_TOLERANCE = 0.01;

const MEASURED_ACTIONS: ReadonlySet<string> = new Set(['type', 'highlight', 'zoom']);

type WalkthroughScene = Extract<MotionStoryboardScene, { kind: 'ui-walkthrough' }>;

const isWalkthrough = (scene: MotionStoryboardScene): scene is WalkthroughScene => scene.kind === 'ui-walkthrough';

function briefBoxesOf(brief: MotionBrief | null, image: string): ImageBox[] | undefined {
  const boxes = brief?.images.find((candidate) => briefImageRef(candidate.file) === image)?.boxes;
  return boxes === undefined || boxes.length === 0 ? undefined : boxes;
}

const format = (value: number): string => String(Math.round(value * 1000) / 1000);
const nameWithOrigin = (box: ImageBox): string => (isMeasuredBox(box) ? `"${box.name}" (${describeMeasuredBox(box)})` : `"${box.name}"`);
const describeBox = (box: ImageBox): string => `x ${format(box.x)}, y ${format(box.y)}, w ${format(box.w)}, h ${format(box.h)}`;

function coversBox(step: WalkthroughStepSpec, box: ImageBox): boolean {
  return (
    step.x !== undefined && step.y !== undefined && step.w !== undefined && step.h !== undefined &&
    Math.abs(step.x - box.x) <= BOX_MATCH_TOLERANCE && Math.abs(step.y - box.y) <= BOX_MATCH_TOLERANCE &&
    Math.abs(step.w - box.w) <= BOX_MATCH_TOLERANCE && Math.abs(step.h - box.h) <= BOX_MATCH_TOLERANCE
  );
}

function distanceToBox(step: WalkthroughStepSpec, box: ImageBox): number {
  return Math.abs((step.x ?? 0) - box.x) + Math.abs((step.y ?? 0) - box.y) + Math.abs((step.w ?? box.w) - box.w) + Math.abs((step.h ?? box.h) - box.h);
}

function closestBox(step: WalkthroughStepSpec, boxes: readonly ImageBox[]): ImageBox {
  return boxes.reduce((best, box) => (distanceToBox(step, box) < distanceToBox(step, best) ? box : best));
}

function stepIssue(step: WalkthroughStepSpec, image: string, boxes: readonly ImageBox[] | undefined): string | null {
  if (step.box !== undefined) {
    if (boxes !== undefined && findBox(boxes, step.box) !== undefined) return null;
    const known = boxes === undefined || boxes.length === 0 ? 'the image has no measured boxes' : `boxes of ${image}: ${boxes.map(nameWithOrigin).join(', ')}`;
    return `box "${step.box}" does not exist (${known})`;
  }
  if (!MEASURED_ACTIONS.has(step.action) || boxes === undefined) return null;
  if (boxes.some((box) => coversBox(step, box))) return null;
  const near = closestBox(step, boxes);
  const given = step.w === undefined || step.h === undefined ? `${step.action} without a measured size` : `${step.action} at x ${format(step.x ?? 0)}, y ${format(step.y ?? 0)}, w ${format(step.w)}, h ${format(step.h)}`;
  return `${given} matches no measured box of ${image}; use box ${nameWithOrigin(near)} (${describeBox(near)}) instead of estimating`;
}

export function checkStoryboardBoxes(storyboard: MotionStoryboard, brief: MotionBrief | null): StoryboardIssue[] {
  const issues: StoryboardIssue[] = [];
  storyboard.scenes.forEach((scene, sceneIndex) => {
    if (!isWalkthrough(scene)) return;
    const boxes = briefBoxesOf(brief, scene.props.image) ?? scene.props.boxes;
    scene.props.steps.forEach((step, stepIndex) => {
      const message = stepIssue(step, scene.props.image, boxes);
      if (message !== null) issues.push({ path: `scenes[${sceneIndex}].props.steps[${stepIndex}]`, message });
    });
  });
  return issues;
}

export function applyBriefBoxes(storyboard: MotionStoryboard, brief: MotionBrief): MotionStoryboard {
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((scene) => {
      if (!isWalkthrough(scene) || !scene.props.steps.some((step) => step.box !== undefined)) return scene;
      const boxes = briefBoxesOf(brief, scene.props.image);
      return boxes === undefined ? scene : { ...scene, props: { ...scene.props, boxes } };
    }),
  };
}

export interface MeasuredBoxNotice {
  image: string;
  name: string;
  measuredBy: string;
  measuredAt: string | null;
  message: string;
}

export function listMeasuredBoxes(brief: MotionBrief | null): MeasuredBoxNotice[] {
  return (brief?.images ?? []).flatMap((entry) => {
    const image = briefImageRef(entry.file);
    return (entry.boxes ?? []).filter(isMeasuredBox).map((box) => ({
      image,
      name: box.name,
      measuredBy: box.measuredBy ?? 'producer',
      measuredAt: box.measuredAt ?? null,
      message: `Caja "${box.name}" de ${image}: ${describeMeasuredBox(box)}; confirmala con el dueño.`,
    }));
  });
}
