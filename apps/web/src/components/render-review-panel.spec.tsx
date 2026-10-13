import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { RenderReviewPanel } from './render-review-panel';
import type { RenderApiClient } from '../api/render-api-client';
import type { ReviewJob, ReviewReport } from '../api/review-types';

const REPORT: ReviewReport = {
  version: 1,
  file: 'out/video.mp4',
  createdAt: '2026-10-11T10:00:00.000Z',
  status: 'fail',
  delivery: { kind: 'tutorial', requiresVoice: true, requiresCaptions: true },
  metrics: { masterIntegratedLufs: -17.2, masterTruePeakDbtp: -0.4, voiceMusicMarginDb: 9.5 },
  findings: [
    { id: 'f1', check: 'master', severity: 'critical', message: 'Master too quiet', proposedFix: 'Raise the master gain' },
    { id: 'f2', check: 'captions', severity: 'suggestion', message: 'Caption wraps', timeRange: { startSec: 62, endSec: 65.4 } },
    { id: 'f3', check: 'silence', severity: 'nitpick', message: 'Short silence' },
  ],
};

function reviewJob(state: ReviewJob['state']): ReviewJob {
  return {
    id: 'rev-1',
    kind: 'review',
    slug: 'demo',
    state,
    createdAt: '2026-10-11T10:05:00.000Z',
    startedAt: null,
    finishedAt: null,
    progress: null,
    report: null,
    error: null,
  };
}

function renderPanel(client: Partial<RenderApiClient>) {
  render(
    <RenderApiProvider client={client as RenderApiClient}>
      <RenderReviewPanel slug="demo" file="out/video.mp4" />
    </RenderApiProvider>,
  );
}

describe('RenderReviewPanel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the status, the key metrics and the findings grouped by severity', async () => {
    renderPanel({ getRenderReview: vi.fn().mockResolvedValue(REPORT) });

    await waitFor(() => expect(screen.getByTestId('review-status').textContent).toBe('With errors'));
    expect(screen.getByTestId('review-metric-lufs').textContent).toBe('-17.2 LUFS');
    expect(screen.getByTestId('review-metric-peak').textContent).toBe('-0.4 dBTP');
    expect(screen.getByTestId('review-metric-margin').textContent).toBe('9.5 dB');
    expect(screen.getByTestId('review-counts').textContent).toBe('1 Critical · 1 Suggestion · 1 Nitpick');

    const critical = within(screen.getByTestId('review-group-critical'));
    expect(critical.getByText('Master too quiet')).toBeTruthy();
    expect(critical.getByText(/Raise the master gain/u)).toBeTruthy();
    const suggestion = within(screen.getByTestId('review-group-suggestion'));
    expect(suggestion.getByText('1:02–1:05')).toBeTruthy();
  });

  it('offers to run the first review when the file has none', async () => {
    renderPanel({ getRenderReview: vi.fn().mockResolvedValue(null) });

    await waitFor(() => expect(screen.getByTestId('review-status').textContent).toBe('Not reviewed'));
    expect(screen.getByRole('button', { name: 'Review' })).toBeTruthy();
  });

  it('queues a review job and reloads the report when it finishes', async () => {
    const fresh: ReviewReport = { ...REPORT, status: 'pass', findings: [] };
    const getRenderReview = vi.fn().mockResolvedValueOnce(REPORT).mockResolvedValue(fresh);
    const createReviewJob = vi.fn().mockResolvedValue(reviewJob('queued'));
    const getRenderJob = vi.fn().mockResolvedValue(reviewJob('succeeded'));
    renderPanel({ getRenderReview, createReviewJob, getRenderJob });

    await waitFor(() => expect(screen.getByTestId('review-status').textContent).toBe('With errors'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Review again' }));
    });

    expect(createReviewJob).toHaveBeenCalledWith('demo', 'out/video.mp4');
    await waitFor(() => expect(screen.getByTestId('review-status').textContent).toBe('Approved'));
    expect(getRenderReview).toHaveBeenCalledTimes(2);
  });

  it('shows the explained error when the review cannot be queued', async () => {
    const createReviewJob = vi.fn().mockRejectedValue(new RenderApiError('REVIEW_INPUTS_UNAVAILABLE', 'no inputs', 422, null));
    renderPanel({ getRenderReview: vi.fn().mockResolvedValue(null), createReviewJob });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Review' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toContain('REVIEW_INPUTS_UNAVAILABLE');
  });

  describe('visual review by scene', () => {
    const frames = [
      { sceneId: 's1', index: 1, startSec: 0, endSec: 8, frames: [{ atSec: 4, frame: 'out/video.review/scene-01.jpg' }], voice: 'Abrí el panel' },
      { sceneId: 's2', index: 2, startSec: 8, endSec: 15, frames: [{ atSec: 11.5, frame: 'out/video.review/scene-02.jpg' }] },
    ];

    function renderWith(report: ReviewReport) {
      renderPanel({ getRenderReview: vi.fn().mockResolvedValue(report) });
    }

    it('shows the unreviewed banner and a sin revisar mark per scene', async () => {
      renderWith({
        ...REPORT,
        sceneFrames: frames,
        findings: [
          { id: 'v0', check: 'visual-not-reviewed', severity: 'critical', message: 'Nadie miró las escenas' },
        ],
      });

      expect(await screen.findByTestId('visual-not-reviewed-banner')).toBeTruthy();
      expect(screen.getByText('Nobody has looked at the scenes of this render yet.')).toBeTruthy();
      expect(screen.getAllByTestId('visual-scene')).toHaveLength(2);
      expect(screen.getAllByTestId('visual-scene-unreviewed')).toHaveLength(2);
    });

    it('shows frame, time range, voice and the recorded verdict of each scene', async () => {
      renderWith({
        ...REPORT,
        sceneFrames: frames,
        visualReview: {
          recordedAt: '2026-10-12T21:00:00.000Z',
          scenes: [
            { sceneId: 's1', shows: 'Panel de ventas', matchesVoice: true, legible: true, couldBeOtherProduct: false, verdict: 'ok', note: 'Se entiende.' },
            { sceneId: 's2', shows: 'Un menú genérico', matchesVoice: false, legible: true, couldBeOtherProduct: true, verdict: 'fix', note: 'No es el producto.' },
          ],
        },
      });

      const scenes = await screen.findAllByTestId('visual-scene');
      const first = within(scenes[0] as HTMLElement);
      expect(first.getByRole('img').getAttribute('src')).toBe('/api/projects/demo/files/out/video.review/scene-01.jpg');
      expect(first.getByText('Scene 1')).toBeTruthy();
      expect(first.getByText('0:00–0:08')).toBeTruthy();
      expect(first.getByText('Abrí el panel')).toBeTruthy();
      expect(first.getByText('OK')).toBeTruthy();
      expect(first.getByText('Shows: Panel de ventas')).toBeTruthy();

      const second = within(scenes[1] as HTMLElement);
      expect(second.getByText('Fix')).toBeTruthy();
      expect(second.getByText('Could be another product').getAttribute('data-good')).toBe('false');
      expect(second.getByText('Matches the voice').getAttribute('data-good')).toBe('false');
      expect(second.getByText('No es el producto.')).toBeTruthy();
      expect(screen.queryByTestId('visual-not-reviewed-banner')).toBeNull();
      expect(screen.queryByTestId('visual-scene-unreviewed')).toBeNull();
    });

    it('renders no visual section for a report without scene frames', async () => {
      renderWith(REPORT);

      await screen.findByTestId('review-status');
      expect(screen.queryByTestId('visual-review')).toBeNull();
    });
  });
});
