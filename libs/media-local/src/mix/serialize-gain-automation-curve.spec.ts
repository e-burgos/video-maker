import { describe, expect, it } from 'vitest';

import { buildGainAutomationCurve } from './gain-automation-curve';
import { serializeGainAutomationCurve } from './serialize-gain-automation-curve';

describe('serializeGainAutomationCurve', () => {
  it('el caso constante con volumen 1 da "volume=1"', () => {
    const curve = buildGainAutomationCurve([], 30);

    expect(serializeGainAutomationCurve(curve)).toBe('volume=1');
  });

  it('el caso constante con otro volumen formatea el numero con formatFilterNumber', () => {
    const curve = buildGainAutomationCurve([{ frame: 0, gainDb: -6 }], 30);

    expect(serializeGainAutomationCurve(curve)).toBe('volume=0.501187234');
  });

  it('el ejemplo de 3 keyframes de §5.3 del architect.md da el string exacto de 148 caracteres', () => {
    const curve = buildGainAutomationCurve(
      [
        { frame: 0, gainDb: -12 },
        { frame: 30, gainDb: -24 },
        { frame: 60, gainDb: -12 },
      ],
      30,
    );

    const expected =
      "volume=volume='min(1,pow(10,(lt(t,0)*(-12)+gte(t,0)*lt(t,1)*((-12)+(-12)*(t-0))+gte(t,1)*lt(t,2)*((-24)+(12)*(t-1))+gte(t,2)*(-12))/20))':eval=frame";

    expect(serializeGainAutomationCurve(curve)).toBe(expected);
    expect(serializeGainAutomationCurve(curve)).toHaveLength(148);
  });
});
