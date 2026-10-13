import { MotionStudioError } from '../errors/motion-studio-error';
import type { SceneOf } from '../storyboard/motion-storyboard.schema';
import { resolveWalkthroughStep } from '../storyboard/resolve-walkthrough-boxes';
import type { ResolvedWalkthroughStep } from '../storyboard/resolve-walkthrough-boxes';
import { animAttrs, esc, headline } from './scene-html';
import type { SceneContext } from './scene-html';
import { autoZoomFocus, calloutRect, pointRect } from './ui-auto-zoom';
import type { AutoZoomFocus, CalloutPlacementSide, UnitRect } from './ui-auto-zoom';

type WalkthroughProps = SceneOf<'ui-walkthrough'>['props'];

interface StepGeometry {
  box: { x: number; y: number; w: number; h: number } | null;
  cursor: { x: number; y: number } | null;
  zoom: { scale: number; cx: number; cy: number } | null;
}

const DEFAULT_TYPE_BOX = { w: 0.3, h: 0.06 };
const DEFAULT_HIGHLIGHT_BOX = { w: 0.2, h: 0.08 };
const DEFAULT_ZOOM_SCALE = 2;
const MIN_ZOOM_SCALE = 1.4;
const MAX_ZOOM_SCALE = 3;
const ZOOM_REGION_MARGIN = 0.9;
const CALLOUT_ALIGN_EDGE = 0.28;
const CALLOUT_BELOW_UNTIL = 0.25;
const AUTO_ZOOM_DELAY = 0.5;

const fraction = (value: number): string => String(Math.round(value * 10000) / 100);
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const percentStyle = (entries: Record<string, number>): string => Object.entries(entries).map(([key, value]) => `${key}:${fraction(value)}%`).join(';');

export function resolveStepGeometry(step: ResolvedWalkthroughStep): StepGeometry {
  const sized = (fallback: { w: number; h: number }) => ({ x: step.x, y: step.y, w: Math.min(step.w ?? fallback.w, 1 - step.x), h: Math.min(step.h ?? fallback.h, 1 - step.y) });
  switch (step.action) {
    case 'move':
    case 'click':
    case 'callout':
      return { box: null, cursor: { x: step.x, y: step.y }, zoom: null };
    case 'type': {
      const box = sized(DEFAULT_TYPE_BOX);
      return { box, cursor: { x: box.x + box.w * 0.1, y: box.y + box.h / 2 }, zoom: null };
    }
    case 'highlight': {
      const box = sized(DEFAULT_HIGHLIGHT_BOX);
      return { box, cursor: { x: box.x + box.w / 2, y: box.y + box.h / 2 }, zoom: null };
    }
    case 'zoom': {
      if (step.w === undefined || step.h === undefined) return { box: null, cursor: null, zoom: { scale: DEFAULT_ZOOM_SCALE, cx: step.x, cy: step.y } };
      const box = sized({ w: step.w, h: step.h });
      const scale = clamp(Math.min(1 / box.w, 1 / box.h) * ZOOM_REGION_MARGIN, MIN_ZOOM_SCALE, MAX_ZOOM_SCALE);
      return { box: null, cursor: null, zoom: { scale, cx: box.x + box.w / 2, cy: box.y + box.h / 2 } };
    }
  }
}

function stepAttrs(step: ResolvedWalkthroughStep, index: number, count: number, anim: string, geometry: StepGeometry, extra: Record<string, string | number> = {}): string {
  const cursor = geometry.cursor ? { px: Math.round(geometry.cursor.x * 10000) / 10000, py: Math.round(geometry.cursor.y * 10000) / 10000 } : {};
  const slot = step.cue === undefined && step.at === undefined ? { slot: index, count } : {};
  return ` data-ui-step="${step.action}"${animAttrs({ anim, cue: step.cue, at: step.cue === undefined ? step.at : undefined, parallel: true, extra: { ...slot, ...cursor, ...extra } })}`;
}

function calloutSides(step: ResolvedWalkthroughStep): CalloutPlacementSide {
  return {
    horizontal: step.x < CALLOUT_ALIGN_EDGE ? 'start' : step.x > 1 - CALLOUT_ALIGN_EDGE ? 'end' : 'mid',
    vertical: step.y < CALLOUT_BELOW_UNTIL ? 'below' : 'above',
  };
}

function calloutPlacement(step: ResolvedWalkthroughStep): string {
  const { horizontal, vertical } = calloutSides(step);
  return `h-${horizontal} v-${vertical}`;
}

function stepRects(step: ResolvedWalkthroughStep): UnitRect[] {
  const geometry = resolveStepGeometry(step);
  if (step.action === 'callout') return [calloutRect(step.x, step.y, step.text ?? '', calloutSides(step))];
  if (geometry.box) return [geometry.box];
  if (geometry.cursor) return [pointRect(geometry.cursor.x, geometry.cursor.y)];
  return [];
}

export function resolveAutoZoom(steps: readonly ResolvedWalkthroughStep[], autoZoom: boolean | undefined): AutoZoomFocus | null {
  if (autoZoom === false || steps.some((step) => step.action === 'zoom')) return null;
  return autoZoomFocus(steps.flatMap(stepRects));
}

function autoZoomMark(focus: AutoZoomFocus | null): string {
  if (focus === null) return '';
  const round = (value: number): number => Math.round(value * 10000) / 10000;
  return `<i class="mg-ui-mark" data-ui-autozoom="1"${animAttrs({ anim: 'ui-autozoom', at: AUTO_ZOOM_DELAY, parallel: true, extra: { scale: round(focus.scale), cx: round(focus.cx), cy: round(focus.cy) } })}></i>`;
}

function stepHtml(step: ResolvedWalkthroughStep, index: number, count: number): string {
  const geometry = resolveStepGeometry(step);
  const { box } = geometry;
  switch (step.action) {
    case 'move':
      return `<i class="mg-ui-mark"${stepAttrs(step, index, count, 'ui-mark', geometry)}></i>`;
    case 'click':
      return `<div class="mg-ui-click" style="${percentStyle({ left: step.x, top: step.y })}"${stepAttrs(step, index, count, 'ui-click', geometry)}><i></i></div>`;
    case 'type':
      return box ? `<div class="mg-ui-type" style="${percentStyle({ left: box.x, top: box.y, width: box.w, height: box.h })}"${stepAttrs(step, index, count, 'ui-type', geometry, { text: step.text ?? '' })}><span></span></div>` : '';
    case 'highlight':
      return box ? `<div class="mg-ui-highlight" style="${percentStyle({ left: box.x, top: box.y, width: box.w, height: box.h })}"${stepAttrs(step, index, count, 'ui-highlight', geometry)}></div>` : '';
    case 'callout':
      return `<div class="mg-ui-anchor" style="${percentStyle({ left: step.x, top: step.y })}"${stepAttrs(step, index, count, 'ui-callout', geometry)}><div class="mg-ui-bubble ${calloutPlacement(step)}">${esc(step.text ?? '')}</div></div>`;
    case 'zoom':
      return geometry.zoom ? `<i class="mg-ui-mark"${stepAttrs(step, index, count, 'ui-zoom', geometry, { scale: geometry.zoom.scale, cx: geometry.zoom.cx, cy: geometry.zoom.cy })}></i>` : '';
  }
}

const CURSOR_SVG =
  '<svg class="mg-ui-cursor" viewBox="0 0 24 32" aria-hidden="true"><path d="M2 2 L2 25 L8 19.6 L12.2 29.4 L16.4 27.6 L12.2 18 L20.6 18 Z" fill="#fff" stroke="#0b0d12" stroke-width="2" stroke-linejoin="round" /></svg>';

function browserBar(url: string | undefined): string {
  return `<div class="mg-ui-bar"><i></i><i></i><i></i><span class="mg-ui-url">${url ? esc(url) : ''}</span></div>`;
}

export function uiWalkthrough(props: WalkthroughProps, ctx: SceneContext): string {
  const kind = props.frame ?? 'browser';
  const resolved = props.steps.map((step, index) => {
    const result = resolveWalkthroughStep(step, props.boxes);
    if (result === null) throw new MotionStudioError('STORYBOARD_INVALID', `ui-walkthrough step ${index + 1}: box "${step.box ?? ''}" is not among the boxes of the image ${props.image}`);
    return result;
  });
  const steps = resolved.map((step, index) => stepHtml(step, index, resolved.length)).join('');
  const layer = `<div class="mg-ui-layer">${autoZoomMark(resolveAutoZoom(resolved, props.autoZoom))}${steps}<div class="mg-ui-track" data-ui-cursor="1"${animAttrs({ anim: 'ui-cursor', parallel: true })}>${CURSOR_SVG}</div></div>`;
  const shot = `<div class="mg-ui-shot"><div class="mg-ui-zoom"><img src="${esc(ctx.imageUrl(props.image))}" alt="" />${layer}</div></div>`;
  const device = `<div class="mg-ui-device ${kind}"${animAttrs({ anim: 'rise', parallel: true })}>${kind === 'browser' ? browserBar(props.url) : ''}${shot}</div>`;
  const head = props.title ? headline(props.title, props.accent) : '';
  return `${head}<div class="mg-ui-stage ${props.title ? 'with-title' : 'no-title'}">${device}</div>`;
}
