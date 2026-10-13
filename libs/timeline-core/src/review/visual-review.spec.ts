import { describe, expect, it } from 'vitest';

import { ReviewReportSchema } from './review-report';
import type { ReviewReport, SceneFrame, SceneVisualReview } from './review-report';
import { VisualReviewDraftSchema, isSceneFlagged, visualReviewProblems, withVisualReview } from './visual-review';

const FRAMES: SceneFrame[] = [
  { sceneId: 'hook', index: 1, startSec: 0, endSec: 4, atSec: 2, frame: 'out/v.review/scene-01.jpg', voice: 'Hola' },
  { sceneId: 'cta', index: 2, startSec: 4, endSec: 10, atSec: 7, frame: 'out/v.review/scene-02.jpg' },
];

function scene(sceneId: string, overrides: Partial<SceneVisualReview> = {}): SceneVisualReview {
  return { sceneId, shows: 'Un título sobre fondo oscuro', matchesVoice: true, legible: true, couldBeOtherProduct: false, verdict: 'ok', note: '', ...overrides };
}

function report(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    version: 1,
    file: 'out/v.mp4',
    createdAt: '2026-10-12T10:00:00.000Z',
    status: 'fail',
    delivery: { kind: 'motion' },
    metrics: {},
    findings: [
      { id: 'visual-not-reviewed-01', check: 'visual-not-reviewed', severity: 'critical', message: 'Nadie miró', proposedFix: 'Mirar' },
      { id: 'master-loudness-01', check: 'master-loudness', severity: 'suggestion', message: 'Un poco alto' },
    ],
    sceneFrames: FRAMES,
    ...overrides,
  };
}

describe('VisualReviewDraftSchema', () => {
  it('fills an empty note and rejects unknown verdicts and empty scene lists', () => {
    const parsed = VisualReviewDraftSchema.parse({ scenes: [{ sceneId: 'a', shows: 'x', matchesVoice: true, legible: true, couldBeOtherProduct: false, verdict: 'ok' }] });

    expect(parsed.scenes[0]?.note).toBe('');
    expect(VisualReviewDraftSchema.safeParse({ scenes: [] }).success).toBe(false);
    expect(VisualReviewDraftSchema.safeParse({ scenes: [{ ...scene('a'), verdict: 'maybe' }] }).success).toBe(false);
  });
});

describe('isSceneFlagged', () => {
  it.each([
    [{ verdict: 'fix' as const }],
    [{ matchesVoice: false }],
    [{ legible: false }],
    [{ couldBeOtherProduct: true }],
  ])('flags a scene with %j', (overrides) => {
    expect(isSceneFlagged(scene('a', overrides))).toBe(true);
  });

  it('does not flag a clean scene', () => {
    expect(isSceneFlagged(scene('a'))).toBe(false);
  });
});

describe('visualReviewProblems', () => {
  it('is empty when every scene is covered once', () => {
    expect(visualReviewProblems({ scenes: [scene('hook'), scene('cta')] }, FRAMES)).toEqual([]);
  });

  it('names missing, unknown and repeated scenes and flagged scenes without a note', () => {
    const problems = visualReviewProblems({ scenes: [scene('hook', { verdict: 'fix' }), scene('hook'), scene('ghost')] }, FRAMES);

    expect(problems).toEqual([
      'scene "hook" is flagged and needs a note saying what to fix',
      'scene "hook" appears twice',
      'unknown scene "ghost"',
      'scene "cta" is missing',
    ]);
  });
});

describe('withVisualReview', () => {
  const RECORDED = '2026-10-12T11:00:00.000Z';

  it('drops visual-not-reviewed and keeps the other findings when every scene is ok', () => {
    const next = withVisualReview(report(), RECORDED, { scenes: [scene('hook'), scene('cta')] });

    expect(next.findings.map((finding) => finding.check)).toEqual(['master-loudness']);
    expect(next.status).toBe('warn');
    expect(next.visualReview?.recordedAt).toBe(RECORDED);
    expect(ReviewReportSchema.safeParse(next).success).toBe(true);
  });

  it('turns each flagged scene into a critical finding with its time range, note and reasons', () => {
    const next = withVisualReview(report(), RECORDED, {
      scenes: [scene('hook', { couldBeOtherProduct: true, note: 'Usar la foto del equipo' }), scene('cta', { legible: false, verdict: 'fix', note: 'Agrandar el texto' })],
    });

    const visual = next.findings.filter((finding) => finding.check === 'visual-review');
    expect(visual.map((finding) => finding.id)).toEqual(['visual-review-01', 'visual-review-02']);
    expect(visual[0]).toMatchObject({ severity: 'critical', timeRange: { startSec: 0, endSec: 4 }, proposedFix: 'Usar la foto del equipo' });
    expect(visual[0]?.message).toContain('podría ser de otro producto');
    expect(visual[1]?.message).toContain('no se lee bien');
    expect(next.status).toBe('fail');
  });

  it('replaces an earlier visual review instead of stacking findings', () => {
    const first = withVisualReview(report(), RECORDED, { scenes: [scene('hook', { verdict: 'fix', note: 'x' }), scene('cta')] });
    const second = withVisualReview(first, RECORDED, { scenes: [scene('hook'), scene('cta')] });

    expect(second.findings.some((finding) => finding.check === 'visual-review')).toBe(false);
    expect(second.status).toBe('warn');
  });
});
