import type { Fps, GainKeyframe } from '@video-maker/timeline-core';

import { buildGainAutomationCurve } from './gain-automation-curve';
import { serializeGainAutomationCurve } from './serialize-gain-automation-curve';

export function buildGainAutomationExpression(
  automation: readonly GainKeyframe[],
  fps: Fps,
): string {
  return serializeGainAutomationCurve(buildGainAutomationCurve(automation, fps));
}
