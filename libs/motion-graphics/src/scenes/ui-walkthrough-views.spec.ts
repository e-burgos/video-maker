import { describe, expect, it } from 'vitest';

import { resolveWalkthroughStep } from '../storyboard/resolve-walkthrough-boxes';
import { visibleViews } from './ui-walkthrough-html';

const boxes = [
  { name: 'brick-pago', x: 0.501, y: 0.316, w: 0.199, h: 0.54 },
  { name: 'recuadro-verde', x: 0.276, y: 0.514, w: 0.148, h: 0.167 },
];

function resolved(steps: object[]) {
  return steps.map((step) => {
    const result = resolveWalkthroughStep(step as Parameters<typeof resolveWalkthroughStep>[0], boxes);
    if (result === null) throw new Error('unresolved step');
    return result;
  });
}

describe('visibleViews', () => {
  it('keeps the full capture when nothing zooms', () => {
    const steps = resolved([{ action: 'callout', box: 'recuadro-verde', text: 'Licencia' }]);
    expect(visibleViews(steps, null)).toEqual([{ x: 0, y: 0, w: 1, h: 1 }]);
  });

  it('carries an explicit zoom window to the callouts that follow it, inside the capture', () => {
    const steps = resolved([
      { action: 'zoom', box: 'brick-pago', at: 0 },
      { action: 'callout', box: 'recuadro-verde', text: 'Licencia mensual cancelable' },
    ]);
    const [zoomView, calloutView] = visibleViews(steps, null);
    expect(calloutView).toEqual(zoomView);
    expect(calloutView?.x).toBeGreaterThanOrEqual(0);
    expect((calloutView?.x ?? 0) + (calloutView?.w ?? 0)).toBeLessThanOrEqual(1);
    const anchorX = 0.276 + 0.148 / 2;
    expect((anchorX - (calloutView?.x ?? 0)) / (calloutView?.w ?? 1)).toBeLessThan(0.3);
  });
});
