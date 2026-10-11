import { ReviewReportSchema } from '@video-maker/timeline-core';
import type { ReviewFinding } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { footageReviewInputs, motionReviewInputs } from '../__fixtures__/review-inputs-fixtures';
import { reviewRender } from './review-rules';

function findingsOf(report: ReturnType<typeof reviewRender>, check: string): ReviewFinding[] {
  return report.findings.filter((finding) => finding.check === check);
}

describe('reviewRender: happy paths', () => {
  it('passes a healthy footage tutorial', () => {
    const report = reviewRender(footageReviewInputs());

    expect(report.status).toBe('pass');
    expect(report.findings).toEqual([]);
    expect(report.metrics['voiceMusicMarginDb']).toBe(20);
    expect(ReviewReportSchema.safeParse(report).success).toBe(true);
  });

  it('passes a healthy motion video', () => {
    const report = reviewRender(motionReviewInputs());

    expect(report.status).toBe('pass');
    expect(report.delivery).toEqual({ kind: 'motion' });
    expect(ReviewReportSchema.safeParse(report).success).toBe(true);
  });
});

describe('master-loudness', () => {
  it('suggests when the integrated loudness is more than 1 LU off', () => {
    const report = reviewRender(footageReviewInputs({ master: { integratedLufs: -12.5, truePeakDbtp: -2 } }));

    expect(findingsOf(report, 'master-loudness').map((finding) => finding.severity)).toEqual(['suggestion']);
    expect(report.status).toBe('warn');
  });

  it('is critical with a fix when more than 3 LU off', () => {
    const report = reviewRender(footageReviewInputs({ master: { integratedLufs: -20, truePeakDbtp: -2 } }));

    const [finding] = findingsOf(report, 'master-loudness');
    expect(finding?.severity).toBe('critical');
    expect(finding?.proposedFix).toContain('6.0');
    expect(report.status).toBe('fail');
  });

  it('suggests when the true peak exceeds -1 dBTP', () => {
    const report = reviewRender(footageReviewInputs({ master: { integratedLufs: -14, truePeakDbtp: -0.2 } }));

    expect(findingsOf(report, 'master-loudness').map((finding) => finding.severity)).toEqual(['suggestion']);
  });
});

describe('voice-music-margin', () => {
  it('is critical on a motion video with loud music, quiet voice and a shallow duck', () => {
    const report = reviewRender(
      motionReviewInputs({
        voiceSegments: [{ startSec: 0.25, endSec: 3.2, voiceLufs: -26, musicLufs: -12, musicGainDb: 20 * Math.log10(0.8 * 0.15) }],
      }),
    );

    const [finding] = findingsOf(report, 'voice-music-margin');
    expect(finding?.severity).toBe('critical');
    expect(finding?.timeRange).toEqual({ startSec: 0.25, endSec: 3.2 });
    expect(finding?.proposedFix).toBeDefined();
    expect(report.metrics['voiceMusicMarginDb']).toBeCloseTo(4.4, 1);
    expect(report.status).toBe('fail');
  });

  it('suggests between 15 and 18 dB and reports the worst segment', () => {
    const report = reviewRender(
      footageReviewInputs({
        voiceSegments: [
          { startSec: 3, endSec: 10, voiceLufs: -14, musicLufs: -16, musicGainDb: -18 },
          { startSec: 20, endSec: 30, voiceLufs: -14, musicLufs: -16, musicGainDb: -15.5 },
        ],
      }),
    );

    expect(findingsOf(report, 'voice-music-margin').map((finding) => finding.severity)).toEqual(['suggestion']);
    expect(report.metrics['voiceMusicMarginDb']).toBe(17.5);
  });

  it('skips segments without measurable voice or music and leaves the metric null', () => {
    const report = reviewRender(
      footageReviewInputs({ voiceSegments: [{ startSec: 3, endSec: 10, voiceLufs: null, musicLufs: -16, musicGainDb: -18 }] }),
    );

    expect(findingsOf(report, 'voice-music-margin')).toEqual([]);
    expect(report.metrics['voiceMusicMarginDb']).toBeNull();
  });
});

describe('duration', () => {
  it('tolerates one frame', () => {
    const report = reviewRender(footageReviewInputs({ actualDurationSec: 60.03 }));

    expect(findingsOf(report, 'duration')).toEqual([]);
  });

  it('is critical when the render differs by more than one frame', () => {
    const report = reviewRender(footageReviewInputs({ actualDurationSec: 59 }));

    const [finding] = findingsOf(report, 'duration');
    expect(finding?.severity).toBe('critical');
    expect(finding?.proposedFix).toBeDefined();
  });
});

describe('duration tolerance by mode', () => {
  it('tolerates two frames in motion and not in footage', () => {
    const twoFramesLong = { actualDurationSec: 30.06 };

    expect(findingsOf(reviewRender(motionReviewInputs(twoFramesLong)), 'duration')).toEqual([]);
    expect(findingsOf(reviewRender(footageReviewInputs({ ...twoFramesLong, actualDurationSec: 60.06 })), 'duration')).toHaveLength(1);
    expect(findingsOf(reviewRender(motionReviewInputs({ actualDurationSec: 30.1 })), 'duration')).toHaveLength(1);
  });
});

describe('black-frames', () => {
  it('ignores black inside the bumpers', () => {
    const report = reviewRender(footageReviewInputs({ blackSegments: [{ startSec: 0, endSec: 1.5 }] }));

    expect(findingsOf(report, 'black-frames')).toEqual([]);
  });

  it('suggests from 1 s and is critical from 3 s', () => {
    const report = reviewRender(
      footageReviewInputs({
        blackSegments: [{ startSec: 20, endSec: 21.5 }, { startSec: 40, endSec: 44 }],
      }),
    );

    expect(findingsOf(report, 'black-frames').map((finding) => finding.severity)).toEqual(['suggestion', 'critical']);
  });
});

describe('frozen-frames', () => {
  const frozen = [{ startSec: 22, endSec: 32 }];

  it('suggests for a long freeze', () => {
    const report = reviewRender(footageReviewInputs({ frozenSegments: [{ startSec: 40, endSec: 50 }] }));

    expect(findingsOf(report, 'frozen-frames').map((finding) => finding.severity)).toEqual(['suggestion']);
  });

  it('downgrades to nitpick when a tutorial freezes while the voice explains', () => {
    const report = reviewRender(footageReviewInputs({ frozenSegments: frozen }));

    expect(findingsOf(report, 'frozen-frames').map((finding) => finding.severity)).toEqual(['nitpick']);
    expect(report.status).toBe('pass');
  });

  it('keeps the suggestion outside tutorials even with voice', () => {
    const report = reviewRender(footageReviewInputs({ frozenSegments: frozen, delivery: { kind: 'short' } }));

    expect(findingsOf(report, 'frozen-frames').map((finding) => finding.severity)).toEqual(['suggestion']);
  });

  it('ignores freezes shorter than 8 s', () => {
    const report = reviewRender(footageReviewInputs({ frozenSegments: [{ startSec: 40, endSec: 45 }] }));

    expect(findingsOf(report, 'frozen-frames')).toEqual([]);
  });
});

describe('voice-silence', () => {
  it('suggests for a silence inside the narrated zone', () => {
    const report = reviewRender(footageReviewInputs({ silences: [{ startSec: 11, endSec: 15 }] }));

    const [finding] = findingsOf(report, 'voice-silence');
    expect(finding?.severity).toBe('suggestion');
    expect(finding?.timeRange).toEqual({ startSec: 11, endSec: 15 });
  });

  it('ignores silences before the first and after the last voice', () => {
    const report = reviewRender(
      footageReviewInputs({ silences: [{ startSec: 0, endSec: 3 }, { startSec: 30, endSec: 58 }] }),
    );

    expect(findingsOf(report, 'voice-silence')).toEqual([]);
  });
});

describe('captions', () => {
  it('suggests when a subtle-lower caption does not fit one line', () => {
    const text = 'Este subtítulo es demasiado largo para entrar en una sola línea de pantalla';
    const report = reviewRender(
      footageReviewInputs({ captions: [{ id: 'c1', startSec: 3, endSec: 6, text, box: null }] }),
    );

    expect(findingsOf(report, 'captions').map((finding) => finding.severity)).toEqual(['suggestion']);
  });

  it('does not apply the one-line rule to other styles', () => {
    const text = 'Este subtítulo es demasiado largo para entrar en una sola línea de pantalla';
    const report = reviewRender(
      footageReviewInputs({ captionStyle: 'bold-impact', captions: [{ id: 'c1', startSec: 3, endSec: 6, text, box: null }] }),
    );

    expect(findingsOf(report, 'captions')).toEqual([]);
  });

  it('flags a caption shorter than 0.7 s as nitpick', () => {
    const report = reviewRender(
      footageReviewInputs({ captions: [{ id: 'c1', startSec: 3, endSec: 3.4, text: 'Hola', box: null }] }),
    );

    expect(findingsOf(report, 'captions').map((finding) => finding.severity)).toEqual(['nitpick']);
  });

  it('is critical when the caption box leaves the safe zone', () => {
    const report = reviewRender(
      footageReviewInputs({
        captions: [{ id: 'c1', startSec: 3, endSec: 6, text: 'Hola mundo', box: { x: 0, y: 900, width: 1920, height: 180 } }],
      }),
    );

    const [finding] = findingsOf(report, 'captions');
    expect(finding?.severity).toBe('critical');
    expect(finding?.proposedFix).toBeDefined();
  });
});

describe('missing-assets', () => {
  it('is critical for every referenced file missing from disk', () => {
    const report = reviewRender(footageReviewInputs({ missingAssets: ['raw/audio/music01.mp3'] }));

    const [finding] = findingsOf(report, 'missing-assets');
    expect(finding?.severity).toBe('critical');
    expect(finding?.message).toContain('raw/audio/music01.mp3');
  });
});

describe('delivery', () => {
  it('is critical for a short longer than 180 s', () => {
    const report = reviewRender(
      footageReviewInputs({ delivery: { kind: 'short' }, actualDurationSec: 200, expectedDurationSec: 200 }),
    );

    expect(findingsOf(report, 'delivery').map((finding) => finding.severity)).toEqual(['critical']);
  });

  it('is critical for a tutorial without voice and without captions', () => {
    const report = reviewRender(footageReviewInputs({ hasVoice: false, captions: [], voiceSegments: [] }));

    expect(findingsOf(report, 'delivery').map((finding) => finding.severity)).toEqual(['critical', 'critical']);
  });

  it('respects requiresVoice and requiresCaptions set to false', () => {
    const report = reviewRender(
      footageReviewInputs({
        delivery: { kind: 'tutorial', requiresVoice: false, requiresCaptions: false },
        hasVoice: false,
        captions: [],
        voiceSegments: [],
      }),
    );

    expect(findingsOf(report, 'delivery')).toEqual([]);
  });

  it('is critical when maxDurationSec is exceeded', () => {
    const report = reviewRender(footageReviewInputs({ delivery: { kind: 'tutorial', maxDurationSec: 45 } }));

    expect(findingsOf(report, 'delivery').map((finding) => finding.severity)).toEqual(['critical']);
  });

  it('does not demand voice or captions from motion', () => {
    const report = reviewRender(motionReviewInputs({ hasVoice: false, voiceSegments: [] }));

    expect(findingsOf(report, 'delivery')).toEqual([]);
  });
});

describe('report shape', () => {
  it('numbers finding ids per check and keeps proposedFix on every critical', () => {
    const report = reviewRender(
      footageReviewInputs({
        blackSegments: [{ startSec: 10, endSec: 14 }, { startSec: 20, endSec: 25 }],
        missingAssets: ['a.png'],
      }),
    );

    expect(report.findings.map((finding) => finding.id)).toEqual(['black-frames-01', 'black-frames-02', 'missing-assets-01']);
    expect(report.findings.filter((finding) => finding.severity === 'critical').every((finding) => finding.proposedFix !== undefined)).toBe(true);
    expect(ReviewReportSchema.safeParse(report).success).toBe(true);
  });
});
