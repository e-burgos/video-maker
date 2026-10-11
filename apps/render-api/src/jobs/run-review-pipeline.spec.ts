import { resolveMediaProject } from '@video-maker/auto-montage';
import { ReviewReportSchema } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { createFakeReviewMeasurements } from '../__fixtures__/fake-review-measurements';
import {
  footageProjectFiles,
  motionProjectFiles,
  REVIEW_PROJECT_ROOT,
} from '../__fixtures__/review-project-fixtures';
import type { ReviewStage } from './render-job';
import { ReviewPipelineCanceledError } from './review-pipeline-observer';
import type { ReviewPipelineObserver } from './review-pipeline-observer';
import { runReviewPipeline } from './run-review-pipeline';

const project = resolveMediaProject(REVIEW_PROJECT_ROOT);

function setup(files: Array<{ path: string; contents: string }>) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [REVIEW_PROJECT_ROOT, `${REVIEW_PROJECT_ROOT}/out`],
    files,
  });
  return { deps: createFakeRenderApiDependencies(callLog, { storage }), storage };
}

function recordingObserver(cancelAt?: ReviewStage): { observer: ReviewPipelineObserver; stages: ReviewStage[] } {
  const stages: ReviewStage[] = [];
  let canceled = false;
  return {
    stages,
    observer: {
      stageStarted: (stage) => {
        stages.push(stage);
        canceled = stage === cancelAt;
      },
      cancellationRequested: () => canceled,
    },
  };
}

describe('runReviewPipeline', () => {
  it('walks collect, measure, rules and write and persists a valid report next to the video', async () => {
    const { deps, storage } = setup(footageProjectFiles());
    const { observer, stages } = recordingObserver();

    const report = await runReviewPipeline(
      { project, file: 'out/demo.mp4', mode: 'footage' },
      deps,
      observer,
      { measurements: createFakeReviewMeasurements({ durationSec: 34 }) },
    );

    expect(stages).toEqual(['collect', 'measure', 'rules', 'write']);
    expect(Object.keys(report).sort()).toEqual(['counts', 'file', 'reviewFile', 'status']);
    expect(report).toEqual({
      file: 'out/demo.mp4',
      reviewFile: 'out/demo.review.json',
      status: 'pass',
      counts: { critical: 0, suggestion: 0, nitpick: 0 },
    });
    const stored = ReviewReportSchema.parse(JSON.parse(await storage.readTextFile(`${REVIEW_PROJECT_ROOT}/out/demo.review.json`)));
    expect(stored.file).toBe('out/demo.mp4');
  });

  it('reviews a motion video and reports the critical findings in the counts', async () => {
    const { deps } = setup(motionProjectFiles());
    const { observer } = recordingObserver();
    const levels = (path: string): number => (path.endsWith('music.wav') ? -12 : -26);

    const report = await runReviewPipeline(
      { project, file: 'out/motion.mp4', mode: 'motion' },
      deps,
      observer,
      { measurements: createFakeReviewMeasurements({ durationSec: 12, levels }) },
    );

    expect(report.status).toBe('fail');
    expect(report.counts.critical).toBeGreaterThan(0);
  });

  it('fails with REVIEW_INPUTS_UNAVAILABLE at the collect stage when the timeline is missing', async () => {
    const { deps } = setup([]);
    const { observer } = recordingObserver();

    await expect(
      runReviewPipeline({ project, file: 'out/demo.mp4', mode: 'footage' }, deps, observer, {
        measurements: createFakeReviewMeasurements({ durationSec: 34 }),
      }),
    ).rejects.toMatchObject({ code: 'REVIEW_INPUTS_UNAVAILABLE', stage: 'collect', resource: 'work/timeline.json' });
  });

  it('stops with the cancellation error and writes nothing when canceled before writing', async () => {
    const { deps, storage } = setup(footageProjectFiles());
    const { observer } = recordingObserver('rules');

    await expect(
      runReviewPipeline({ project, file: 'out/demo.mp4', mode: 'footage' }, deps, observer, {
        measurements: createFakeReviewMeasurements({ durationSec: 34 }),
      }),
    ).rejects.toBeInstanceOf(ReviewPipelineCanceledError);
    expect(await storage.stat(`${REVIEW_PROJECT_ROOT}/out/demo.review.json`)).toBeNull();
  });
});
