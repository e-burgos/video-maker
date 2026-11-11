import { describe, expect, it } from 'vitest';

import { sfxDensityFindings, sfxRepetitionFindings } from './sfx-pattern-rules';

const at = (sound: string, startSec: number) => ({ sound, startSec });

describe('sfx-repetition', () => {
  it('flags the motion videos that play the same whoosh on every one of six cuts', () => {
    const events = [5.4, 11.4, 17.4, 22.9, 28.9, 34.4].map((start) => at('whoosh', start));

    const [finding, ...rest] = sfxRepetitionFindings(events);

    expect(rest).toEqual([]);
    expect(finding).toMatchObject({ check: 'sfx-repetition', severity: 'suggestion', timeRange: { startSec: 5.4, endSec: 34.4 } });
    expect(finding?.message).toContain('«whoosh» 6 veces seguidas');
  });

  it('lets four in a row pass and counts runs in time order, not in the order they were listed', () => {
    expect(sfxRepetitionFindings([1, 2, 3, 4].map((start) => at('whoosh', start)))).toEqual([]);
    const shuffled = [at('whoosh', 5), at('whoosh', 1), at('impact', 3), at('whoosh', 2), at('whoosh', 4), at('whoosh', 6)];
    expect(sfxRepetitionFindings(shuffled)).toEqual([]);
  });

  it('treats different variants as different sounds', () => {
    expect(sfxRepetitionFindings([1, 2, 3, 4, 5].map((start, index) => at(`whoosh-${String((index % 2) + 1)}`, start)))).toEqual([]);
  });
});

describe('sfx-density', () => {
  it('flags more than four effects inside three seconds', () => {
    const findings = sfxDensityFindings([10, 10.4, 11, 11.5, 12.2, 30].map((start, index) => at(`s${String(index)}`, start)), 60);

    expect(findings).toEqual([expect.objectContaining({ check: 'sfx-density', timeRange: { startSec: 10, endSec: 13 } })]);
  });

  it('flags a video that averages more than twenty effects a minute', () => {
    const events = Array.from({ length: 25 }, (_, index) => at(`s${String(index % 3)}`, index * 2.4));

    expect(sfxDensityFindings(events, 60).map((finding) => finding.message)).toEqual([expect.stringContaining('25 efectos de sonido por minuto')]);
  });

  it('accepts the sparse effects of a normal video', () => {
    expect(sfxDensityFindings([5, 11, 17, 23, 29].map((start) => at('whoosh', start)), 35)).toEqual([]);
  });
});
