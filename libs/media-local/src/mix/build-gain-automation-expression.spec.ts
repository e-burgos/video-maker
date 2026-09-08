import { describe, expect, it } from 'vitest';

import { buildGainAutomationExpression } from './build-gain-automation-expression';

describe('buildGainAutomationExpression', () => {
  it('automation vacío devuelve exactamente la identidad "volume=1" (CA-001)', () => {
    expect(buildGainAutomationExpression([], 30)).toBe('volume=1');
  });

  it('un solo keyframe devuelve la constante formateada', () => {
    expect(buildGainAutomationExpression([{ frame: 0, gainDb: -6 }], 30)).toBe('volume=0.501187234');
  });

  it('el ejemplo de 3 keyframes de §5.3 del architect.md da el string exacto de 148 caracteres', () => {
    const expression = buildGainAutomationExpression(
      [
        { frame: 0, gainDb: -12 },
        { frame: 30, gainDb: -24 },
        { frame: 60, gainDb: -12 },
      ],
      30,
    );

    expect(expression).toBe(
      "volume=volume='min(1,pow(10,(lt(t,0)*(-12)+gte(t,0)*lt(t,1)*((-12)+(-12)*(t-0))+gte(t,1)*lt(t,2)*((-24)+(12)*(t-1))+gte(t,2)*(-12))/20))':eval=frame",
    );
    expect(expression).toHaveLength(148);
  });
});
