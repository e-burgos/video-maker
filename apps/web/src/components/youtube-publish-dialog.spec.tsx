import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import { YouTubePublishDialog } from './youtube-publish-dialog';
import type { RenderApiClient } from '../api/render-api-client';
import type { PublishJob, YouTubeIntegration, YouTubePublishOptions } from '../api/youtube-types';

const CONNECTED: YouTubeIntegration = {
  clientConfigured: true,
  connected: true,
  channel: { id: 'UC1', title: 'My Channel', thumbnailUrl: null },
};

const OPTIONS: YouTubePublishOptions = {
  files: [
    { path: 'out/short.mp4', durationSec: 45, width: 1080, height: 1920, isShort: true, sizeBytes: 4_200_000, reviewStatus: null },
    { path: 'out/video.mp4', durationSec: 125, width: 1920, height: 1080, isShort: false, sizeBytes: 21_000_000, reviewStatus: null },
  ],
  playlists: [{ id: 'PL1', title: 'Tutorials' }],
  defaults: { privacy: 'public' },
};

function job(overrides: Partial<PublishJob> = {}): PublishJob {
  return {
    id: 'job-1',
    kind: 'publish',
    slug: 'demo',
    state: 'running',
    createdAt: '2026-10-08T10:00:00.000Z',
    startedAt: '2026-10-08T10:00:01.000Z',
    finishedAt: null,
    progress: { stage: 'upload', percent: 40 },
    report: null,
    error: null,
    ...overrides,
  };
}

function baseClient(overrides: Partial<RenderApiClient> = {}): Partial<RenderApiClient> {
  return {
    getYouTubeIntegration: vi.fn().mockResolvedValue(CONNECTED),
    getYouTubePublishOptions: vi.fn().mockResolvedValue(OPTIONS),
    listAssets: vi.fn().mockResolvedValue({
      slug: 'demo',
      source: 'catalog',
      assets: [
        { path: 'raw/images/cover.png', role: 'image', fingerprint: { sizeBytes: 1, modifiedAtMs: 1 }, media: null },
        { path: 'raw/music/theme.mp3', role: 'music', fingerprint: { sizeBytes: 1, modifiedAtMs: 1 }, media: null },
      ],
      probeFailures: [],
    }),
    ...overrides,
  };
}

function renderDialog(client: Partial<RenderApiClient>, onPublished = vi.fn(), onClose = vi.fn()) {
  render(
    <RenderApiProvider client={client as RenderApiClient}>
      <MemoryRouter>
        <YouTubePublishDialog slug="demo" onClose={onClose} onPublished={onPublished} />
      </MemoryRouter>
    </RenderApiProvider>,
  );
  return { onPublished, onClose };
}

async function waitForForm() {
  await waitFor(() => expect(screen.getByLabelText('Title')).toBeTruthy());
}

function futureLocalValue(): string {
  const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T10:30`;
}

describe('YouTubePublishDialog', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('explains that YouTube is not connected and links to Settings', async () => {
    renderDialog(
      baseClient({
        getYouTubeIntegration: vi
          .fn()
          .mockResolvedValue({ clientConfigured: true, connected: false, channel: null }),
      }),
    );

    await waitFor(() => expect(screen.getByTestId('youtube-not-connected')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Go to Settings' }).getAttribute('href')).toBe('/settings');
    expect(screen.queryByLabelText('Title')).toBeNull();
  });

  it('defaults to the first file and shows its duration, size and Short badge', async () => {
    renderDialog(baseClient());

    await waitForForm();
    expect((screen.getByLabelText('Video') as HTMLSelectElement).value).toBe('out/short.mp4');
    const summary = screen.getByTestId('youtube-file-summary');
    expect(summary.textContent).toContain('0:45');
    expect(summary.textContent).toContain('4.2 MB');
    expect(summary.textContent).toContain('Short');

    fireEvent.change(screen.getByLabelText('Video'), { target: { value: 'out/video.mp4' } });
    expect(screen.getByTestId('youtube-file-summary').textContent).not.toContain('Short');
  });

  it('says so when the project has no finished video', async () => {
    renderDialog(baseClient({ getYouTubePublishOptions: vi.fn().mockResolvedValue({ ...OPTIONS, files: [] }) }));

    await waitFor(() => expect(screen.getByTestId('youtube-no-files')).toBeTruthy());
  });

  it('fills title, description and tags with the producer proposal while showing the wait', async () => {
    let resolveDraft: (value: { title: string; description: string; tags: string[] }) => void = () => undefined;
    const draftYouTubeMetadata = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveDraft = resolve;
      }),
    );
    renderDialog(baseClient({ draftYouTubeMetadata }));

    await waitForForm();
    fireEvent.click(screen.getByTestId('youtube-draft'));

    await waitFor(() => expect(screen.getByText('This can take up to a minute.')).toBeTruthy());
    expect(draftYouTubeMetadata).toHaveBeenCalledWith('demo', 'out/short.mp4');

    await act(async () => {
      resolveDraft({ title: 'Proposed title', description: 'Proposed body', tags: ['alpha', 'beta'] });
    });

    await waitFor(() => expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Proposed title'));
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Proposed body');
    expect(within(screen.getByTestId('youtube-tag-list')).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId('youtube-title-counter').textContent).toBe('14/100');
    expect(screen.getByTestId('youtube-tags-counter').textContent).toBe('9/500');
  });

  it('keeps the form and shows the error when the producer fails', async () => {
    renderDialog(
      baseClient({ draftYouTubeMetadata: vi.fn().mockRejectedValue(new RenderApiError('PRODUCER_UNAVAILABLE', 'no engine', 503, null)) }),
    );

    await waitForForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByTestId('youtube-draft'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('PRODUCER_UNAVAILABLE'));
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Mine');
  });

  it('blocks publishing while a limit is exceeded and flags the counter', async () => {
    renderDialog(baseClient());

    await waitForForm();
    const submit = screen.getByTestId('youtube-publish-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'x'.repeat(101) } });

    expect(screen.getByTestId('youtube-title-counter').getAttribute('data-over')).toBe('true');
    expect(screen.getByTestId('youtube-publish-issues').textContent).toContain('at most 100 characters');
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'ok' } });
    expect(submit.disabled).toBe(false);
  });

  it('adds tags with Enter and removes them', async () => {
    renderDialog(baseClient());

    await waitForForm();
    const input = screen.getByLabelText('Tags');
    fireEvent.change(input, { target: { value: 'first, second' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(within(screen.getByTestId('youtube-tag-list')).getAllByRole('listitem')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Remove the tag first' }));
    expect(within(screen.getByTestId('youtube-tag-list')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('rejects a scheduled moment in the past and explains the private upload', async () => {
    renderDialog(baseClient());

    await waitForForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Scheduled' } });
    fireEvent.click(screen.getByLabelText('Schedule'));

    expect(screen.getByText(/uploaded as private/u)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Publication date and time'), { target: { value: '2020-01-01T10:00' } });

    expect(screen.getByTestId('youtube-publish-issues').textContent).toContain('must be in the future');
    expect((screen.getByTestId('youtube-publish-submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks for confirmation before publishing publicly and names the channel', async () => {
    const createPublishJob = vi.fn().mockResolvedValue(job());
    renderDialog(baseClient({ createPublishJob, getRenderJob: vi.fn().mockResolvedValue(job()) }));

    await waitForForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Public one' } });
    fireEvent.click(screen.getByTestId('youtube-publish-submit'));

    expect(screen.getByTestId('youtube-publish-confirm-text').textContent).toBe(
      'This will be published on your channel My Channel, visible to everyone.',
    );
    expect(createPublishJob).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('youtube-publish-confirm'));

    await waitFor(() => expect(createPublishJob).toHaveBeenCalledTimes(1));
    expect(createPublishJob).toHaveBeenCalledWith('demo', {
      file: 'out/short.mp4',
      title: 'Public one',
      description: '',
      tags: [],
      privacy: 'public',
    });
  });

  it('can go back from the confirmation without uploading', async () => {
    const createPublishJob = vi.fn();
    renderDialog(baseClient({ createPublishJob }));

    await waitForForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Public one' } });
    fireEvent.click(screen.getByTestId('youtube-publish-submit'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Public one');
    expect(createPublishJob).not.toHaveBeenCalled();
  });

  it('publishes a private scheduled video with playlist and thumbnail without asking for confirmation', async () => {
    const createPublishJob = vi.fn().mockResolvedValue(job());
    renderDialog(baseClient({ createPublishJob, getRenderJob: vi.fn().mockResolvedValue(job()) }));

    await waitForForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Quiet one' } });
    fireEvent.click(screen.getByLabelText('Private'));
    fireEvent.click(screen.getByLabelText('Schedule'));
    const local = futureLocalValue();
    fireEvent.change(screen.getByLabelText('Publication date and time'), { target: { value: local } });
    fireEvent.change(screen.getByLabelText('Playlist (optional)'), { target: { value: 'PL1' } });
    expect(within(screen.getByLabelText('Thumbnail (optional)')).queryByText('raw/music/theme.mp3')).toBeNull();
    fireEvent.change(screen.getByLabelText('Thumbnail (optional)'), { target: { value: 'raw/images/cover.png' } });
    fireEvent.click(screen.getByTestId('youtube-publish-submit'));

    await waitFor(() => expect(createPublishJob).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('youtube-publish-confirm-text')).toBeNull();
    expect(createPublishJob).toHaveBeenCalledWith('demo', {
      file: 'out/short.mp4',
      title: 'Quiet one',
      description: '',
      tags: [],
      privacy: 'private',
      publishAt: new Date(local).toISOString(),
      playlistId: 'PL1',
      thumbnail: 'raw/images/cover.png',
    });
  });

  it('shows the byte progress, then the link to the video and refreshes the publications', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const getRenderJob = vi
      .fn()
      .mockResolvedValueOnce(job({ progress: { stage: 'upload', percent: 40 } }))
      .mockResolvedValue(
        job({
          state: 'succeeded',
          finishedAt: '2026-10-08T10:01:00.000Z',
          progress: { stage: 'upload', percent: 100 },
          report: {
            videoId: 'abc123',
            url: 'https://youtu.be/abc123',
            privacy: 'public',
            publishAt: null,
            title: 'Public one',
          },
        }),
      );
    const { onPublished } = renderDialog(
      baseClient({ createPublishJob: vi.fn().mockResolvedValue(job()), getRenderJob }),
    );

    await waitForForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Public one' } });
    fireEvent.click(screen.getByTestId('youtube-publish-submit'));
    fireEvent.click(screen.getByTestId('youtube-publish-confirm'));

    await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40'));
    expect(screen.getByTestId('youtube-publish-percent').textContent).toBe('40%');
    expect(screen.getByRole('button', { name: 'Cancel upload' })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await waitFor(() => expect(screen.getByTestId('youtube-publish-success')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Open on YouTube' }).getAttribute('href')).toBe('https://youtu.be/abc123');
    expect(onPublished).toHaveBeenCalled();
  });

  it('cancels a running upload', async () => {
    const cancelRenderJob = vi.fn().mockResolvedValue({ status: 202, job: job({ state: 'canceling' }) });
    renderDialog(
      baseClient({
        createPublishJob: vi.fn().mockResolvedValue(job()),
        getRenderJob: vi.fn().mockResolvedValue(job()),
        cancelRenderJob,
      }),
    );

    await waitForForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Quiet' } });
    fireEvent.click(screen.getByLabelText('Unlisted'));
    fireEvent.click(screen.getByTestId('youtube-publish-submit'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel upload' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel upload' }));

    await waitFor(() => expect(cancelRenderJob).toHaveBeenCalledWith('job-1'));
  });

  it('shows the explained error of a failed upload and retries the job', async () => {
    const failed = job({
      state: 'failed',
      progress: null,
      error: { code: 'YOUTUBE_UPLOAD_FAILED', stage: null, message: 'Google answered 503' },
    });
    const retryJob = vi.fn().mockResolvedValue(job());
    const getRenderJob = vi.fn().mockResolvedValueOnce(failed).mockResolvedValue(job());
    renderDialog(
      baseClient({ createPublishJob: vi.fn().mockResolvedValue(job()), getRenderJob, retryJob }),
    );

    await waitForForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Quiet' } });
    fireEvent.click(screen.getByLabelText('Private'));
    fireEvent.click(screen.getByTestId('youtube-publish-submit'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('YOUTUBE_UPLOAD_FAILED'));
    expect(screen.getByRole('alert').textContent).toContain('did not accept the upload');

    fireEvent.click(screen.getByRole('button', { name: 'Run again' }));

    await waitFor(() => expect(retryJob).toHaveBeenCalledWith('job-1'));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  describe('automatic review', () => {
    const FAILING_OPTIONS: YouTubePublishOptions = {
      ...OPTIONS,
      files: OPTIONS.files.map((file, index) => ({ ...file, reviewStatus: index === 0 ? 'fail' : 'warn' })),
    };
    const FAILING_REPORT = {
      version: 1,
      file: 'out/short.mp4',
      createdAt: '2026-10-11T10:00:00.000Z',
      status: 'fail',
      delivery: { kind: 'short', requiresVoice: false, requiresCaptions: false },
      metrics: {},
      findings: [
        { id: 'f1', check: 'master', severity: 'critical', message: 'Master too loud', proposedFix: 'Lower it' },
        { id: 'f2', check: 'captions', severity: 'suggestion', message: 'Caption too long' },
      ],
    };

    function reviewClient(createPublishJob = vi.fn().mockResolvedValue(job())) {
      return baseClient({
        getYouTubePublishOptions: vi.fn().mockResolvedValue(FAILING_OPTIONS),
        getRenderReview: vi.fn().mockResolvedValue(FAILING_REPORT),
        createPublishJob,
        getRenderJob: vi.fn().mockResolvedValue(job()),
      });
    }

    it('lists the critical findings and blocks publishing until the review is ignored explicitly', async () => {
      const createPublishJob = vi.fn().mockResolvedValue(job());
      renderDialog(reviewClient(createPublishJob));

      await waitForForm();
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Risky' } });
      fireEvent.click(screen.getByLabelText('Private'));

      await waitFor(() => expect(screen.getByText('Master too loud')).toBeTruthy());
      expect(screen.queryByText('Caption too long')).toBeNull();
      expect((screen.getByTestId('youtube-publish-submit') as HTMLButtonElement).disabled).toBe(true);

      fireEvent.click(screen.getByRole('checkbox', { name: 'Publish anyway (ignore the review)' }));
      fireEvent.click(screen.getByTestId('youtube-publish-submit'));

      await waitFor(() => expect(createPublishJob).toHaveBeenCalledTimes(1));
      expect(createPublishJob).toHaveBeenCalledWith('demo', expect.objectContaining({ ignoreReview: true }));
    });

    it('only warns softly when the review has suggestions and never sends ignoreReview', async () => {
      const createPublishJob = vi.fn().mockResolvedValue(job());
      renderDialog(reviewClient(createPublishJob));

      await waitForForm();
      fireEvent.change(screen.getByLabelText('Video'), { target: { value: 'out/video.mp4' } });
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fine' } });
      fireEvent.click(screen.getByLabelText('Private'));

      expect(screen.getByTestId('youtube-review-warn')).toBeTruthy();
      expect(screen.queryByRole('checkbox', { name: 'Publish anyway (ignore the review)' })).toBeNull();

      fireEvent.click(screen.getByTestId('youtube-publish-submit'));
      await waitFor(() => expect(createPublishJob).toHaveBeenCalledTimes(1));
      expect(createPublishJob.mock.calls[0]?.[1]).not.toHaveProperty('ignoreReview');
    });

    it('shows no review notice for files without a failing or warning review', async () => {
      renderDialog(baseClient());

      await waitForForm();
      expect(screen.queryByTestId('youtube-review-fail')).toBeNull();
      expect(screen.queryByTestId('youtube-review-warn')).toBeNull();
    });
  });

  it('adds the file to the queue with the form metadata and links to the queue', async () => {
    const addToPublishQueue = vi.fn().mockResolvedValue({
      item: { id: 'q1' },
      alreadyPublished: null,
    });
    renderDialog(baseClient({ addToPublishQueue }));

    await waitForForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Queued title' } });
    fireEvent.change(screen.getByLabelText('Playlist (optional)'), { target: { value: 'PL1' } });
    fireEvent.click(screen.getByTestId('youtube-publish-queue'));

    await waitFor(() => expect(screen.getByTestId('youtube-queued')).toBeTruthy());
    expect(addToPublishQueue).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'demo', file: 'out/short.mp4', title: 'Queued title', playlistIds: ['PL1'] }),
    );
    expect(screen.queryByTestId('youtube-queued-already-published')).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to the publish queue' }).getAttribute('href')).toBe('/publish-queue');
  });

  it('warns with the link when the queued file is already published', async () => {
    const addToPublishQueue = vi.fn().mockResolvedValue({
      item: { id: 'q1' },
      alreadyPublished: { url: 'https://youtu.be/abc' },
    });
    renderDialog(baseClient({ addToPublishQueue }));

    await waitForForm();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Again' } });
    fireEvent.click(screen.getByTestId('youtube-publish-queue'));

    await waitFor(() => expect(screen.getByTestId('youtube-queued-already-published')).toBeTruthy());
    expect(screen.getByTestId('youtube-queued-already-published').textContent).toContain('This file is already published:');
    expect(screen.getByRole('link', { name: 'https://youtu.be/abc' }).getAttribute('href')).toBe('https://youtu.be/abc');
  });
});
