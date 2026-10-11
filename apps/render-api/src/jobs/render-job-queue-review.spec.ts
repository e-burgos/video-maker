import { describe, expect, it, vi } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { createFakeReviewMeasurements } from '../__fixtures__/fake-review-measurements';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import { createRecordingLogger } from '../__fixtures__/recording-logger';
import {
  footageProjectFiles,
  motionProjectFiles,
  REVIEW_PROJECT_ROOT,
} from '../__fixtures__/review-project-fixtures';
import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { MotionJobReport } from './render-job';
import { createRenderJobQueue } from './render-job-queue';
import { runMotionPipeline } from './run-motion-pipeline';

vi.mock('./run-motion-pipeline', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./run-motion-pipeline')>()),
  runMotionPipeline: vi.fn(),
}));

const MEASUREMENTS = createFakeReviewMeasurements({
  durationSec: 12,
  levels: (path) => (path.endsWith('music.wav') || path.endsWith('music.mp3') ? -40 : -14),
});

function harness(files: Array<{ path: string; contents: string }>, mode?: 'motion') {
  const callLog = createCallLog();
  const logger = createRecordingLogger();
  const storage = createFakeObjectStorage(callLog, {
    directories: [REVIEW_PROJECT_ROOT, `${REVIEW_PROJECT_ROOT}/out`],
    files,
  });
  const deps = createFakeRenderApiDependencies(callLog, { storage, logger });
  deps.localStore.projects.insert('demo', null, mode ?? 'footage');
  return { deps, logger };
}

function queueFor(deps: RenderApiDependencies) {
  return createRenderJobQueue(deps, undefined, undefined, {}, { measurements: MEASUREMENTS });
}

describe('automatic review after a render', () => {
  it('queues a review job for the rendered mp4 and the parent stays succeeded', async () => {
    const { deps } = harness(footageProjectFiles());
    const queue = queueFor(deps);

    const render = queue.create({ kind: 'render', slug: 'demo', projectRoot: REVIEW_PROJECT_ROOT, timeline: buildMinimalTimeline() });
    await queue.whenIdle();

    const review = queue.listBySlug('demo').find((job) => job.kind === 'review');
    expect(queue.get(render.id)?.state).toBe('succeeded');
    expect(review).toMatchObject({ kind: 'review', state: 'succeeded' });
    expect(review?.report).toMatchObject({ file: `out/${render.id}.mp4`, reviewFile: `out/${render.id}.review.json` });
  });

  it('records a typed failure on the review job when the project has no timeline', async () => {
    const { deps } = harness([]);
    const queue = queueFor(deps);

    queue.create({ kind: 'render', slug: 'demo', projectRoot: REVIEW_PROJECT_ROOT, timeline: buildMinimalTimeline() });
    await queue.whenIdle();

    expect(queue.listBySlug('demo').find((job) => job.kind === 'review')).toMatchObject({
      state: 'failed',
      error: { code: 'REVIEW_INPUTS_UNAVAILABLE', stage: 'collect' },
    });
  });

  it('does not touch the render when the review cannot be enqueued, and logs the warning', async () => {
    const { deps, logger } = harness(footageProjectFiles());
    const insert = deps.localStore.jobs.insert.bind(deps.localStore.jobs);
    vi.spyOn(deps.localStore.jobs, 'insert').mockImplementation((row) => {
      if (row.kind === 'review') {
        throw new Error('disk full');
      }
      insert(row);
    });
    const queue = queueFor(deps);

    const render = queue.create({ kind: 'render', slug: 'demo', projectRoot: REVIEW_PROJECT_ROOT, timeline: buildMinimalTimeline() });
    await queue.whenIdle();

    expect(queue.get(render.id)?.state).toBe('succeeded');
    expect(queue.listBySlug('demo').some((job) => job.kind === 'review')).toBe(false);
    expect(logger.events().some((event) => event.event === 'review-job-enqueue-failed')).toBe(true);
  });

  it('reviews the video a motion job renders, in motion mode', async () => {
    const report: MotionJobReport = { path: 'out/motion.mp4', durationSec: 12, scenes: 2, musicCredit: null, storyboard: null };
    vi.mocked(runMotionPipeline).mockResolvedValue(report);
    const { deps } = harness(motionProjectFiles(), 'motion');
    const queue = queueFor(deps);

    queue.create({ kind: 'motion', slug: 'demo', projectRoot: REVIEW_PROJECT_ROOT, phase: 'all', output: 'motion.mp4', takes: 1 });
    await queue.whenIdle();

    const review = queue.listBySlug('demo').find((job) => job.kind === 'review');
    expect(review).toMatchObject({
      state: 'succeeded',
      report: { file: 'out/motion.mp4', reviewFile: 'out/motion.review.json', status: 'pass' },
    });
  });

  it('does not queue a review for a motion job that only built the storyboard', async () => {
    vi.mocked(runMotionPipeline).mockResolvedValue({ path: null, durationSec: null, scenes: 2, musicCredit: null, storyboard: null });
    const { deps } = harness(motionProjectFiles(), 'motion');
    const queue = queueFor(deps);

    queue.create({ kind: 'motion', slug: 'demo', projectRoot: REVIEW_PROJECT_ROOT, phase: 'storyboard', output: 'motion.mp4', takes: 1 });
    await queue.whenIdle();

    expect(queue.listBySlug('demo').map((job) => job.kind)).toEqual(['motion']);
  });
});

describe('review jobs: cancel and retry', () => {
  it('cancels a queued review job', () => {
    const { deps } = harness(footageProjectFiles());
    const queue = queueFor(deps);
    queue.create({ kind: 'render', slug: 'demo', projectRoot: REVIEW_PROJECT_ROOT, timeline: buildMinimalTimeline() });
    const review = queue.create({ kind: 'review', slug: 'demo', projectRoot: REVIEW_PROJECT_ROOT, file: 'out/demo.mp4' });

    expect(queue.cancel(review.id).kind).toBe('canceled');
  });
});
