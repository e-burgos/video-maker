import { formatFilterNumber } from './format-filter-number';
import type { GainAutomationCurve, GainAutomationSegment } from './gain-automation-curve';

type PiecewiseGainAutomationCurve = Extract<GainAutomationCurve, { kind: 'piecewise' }>;

function formatHeaderTerm(curve: PiecewiseGainAutomationCurve): string {
  return `lt(t,${formatFilterNumber(curve.firstSeconds)})*(${formatFilterNumber(curve.firstGainDb)})`;
}

function formatSegmentTerm(segment: GainAutomationSegment): string {
  const start = formatFilterNumber(segment.startSeconds);
  const end = formatFilterNumber(segment.endSeconds);
  const gain = formatFilterNumber(segment.startGainDb);
  const slope = formatFilterNumber(segment.slopeDbPerSecond);

  return `gte(t,${start})*lt(t,${end})*((${gain})+(${slope})*(t-${start}))`;
}

function formatTailTerm(curve: PiecewiseGainAutomationCurve): string {
  return `gte(t,${formatFilterNumber(curve.lastSeconds)})*(${formatFilterNumber(curve.lastGainDb)})`;
}

export function serializeGainAutomationCurve(curve: GainAutomationCurve): string {
  if (curve.kind === 'constant') {
    return `volume=${formatFilterNumber(curve.volume)}`;
  }

  const terms = [formatHeaderTerm(curve), ...curve.segments.map(formatSegmentTerm), formatTailTerm(curve)];

  return `volume=volume='min(1,pow(10,(${terms.join('+')})/20))':eval=frame`;
}
