import { resolveMediaProject } from '@video-maker/auto-montage';
import { ReferenceBriefSchema } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeReferenceMeasurements } from '../__fixtures__/fake-reference-measurements';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { ReferencePipelineCanceledError } from './reference-pipeline-observer';
import type { ReferencePipelineObserver } from './reference-pipeline-observer';
import type { ReferenceStage } from './render-job';
import { runReferencePipeline } from './run-reference-pipeline';

const PROJECT_ROOT = '/media/demo';
const FILE = 'raw/reference/modelo.mp4';
const project = resolveMediaProject(PROJECT_ROOT);

function setup() {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [PROJECT_ROOT, `${PROJECT_ROOT}/raw/reference`],
    files: [{ path: `${PROJECT_ROOT}/${FILE}`, contents: 'video' }],
  });
  return { callLog, storage, deps: createFakeRenderApiDependencies(callLog, { storage }) };
}

function recordingObserver(cancelAt?: ReferenceStage): { observer: ReferencePipelineObserver; stages: ReferenceStage[] } {
  const stages: ReferenceStage[] = [];
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

describe('runReferencePipeline', () => {
  it('walks probe, scenes, transcribe, keyframes and persist and writes a valid brief', async () => {
    const { deps, storage, callLog } = setup();
    const { observer, stages } = recordingObserver();

    const report = await runReferencePipeline({ project, file: FILE }, deps, observer, {
      measurements: createFakeReferenceMeasurements({ cuts: [10, 20] }),
    });

    expect(stages).toEqual(['probe', 'scenes', 'transcribe', 'keyframes', 'persist']);
    expect(Object.keys(report).sort()).toEqual(['briefFile', 'cutsPerMinute', 'durationSec', 'file', 'hasVoice', 'name', 'scenes']);
    expect(report).toEqual({
      file: FILE,
      name: 'modelo',
      briefFile: 'work/reference/modelo.brief.json',
      durationSec: 30,
      scenes: 3,
      cutsPerMinute: 4,
      hasVoice: true,
    });
    const stored = ReferenceBriefSchema.parse(JSON.parse(await storage.readTextFile(`${PROJECT_ROOT}/work/reference/modelo.brief.json`)));
    expect(stored.scenes).toHaveLength(3);
    expect(stored.voice?.transcript).toEqual([{ startSec: 0, endSec: 0.9, text: 'hola mundo' }]);
    expect(stored.audio.integratedLufs).toBe(-16.4);
    expect(callLog.entries().some((entry) => entry.port === 'transcribeVoice')).toBe(true);
  });

  it('skips transcription and leaves voice null when the video has no audio track', async () => {
    const { deps, storage, callLog } = setup();
    const { observer } = recordingObserver();

    const report = await runReferencePipeline({ project, file: FILE }, deps, observer, {
      measurements: createFakeReferenceMeasurements({ probe: { hasAudio: false } }),
    });

    expect(report.hasVoice).toBe(false);
    expect(callLog.entries().some((entry) => entry.port === 'transcribeVoice')).toBe(false);
    const stored = ReferenceBriefSchema.parse(JSON.parse(await storage.readTextFile(`${PROJECT_ROOT}/work/reference/modelo.brief.json`)));
    expect(stored.audio).toEqual({ integratedLufs: null, longSilences: [] });
  });

  it('fails with REFERENCE_FILE_INVALID at the probe stage when the file has no video stream', async () => {
    const { deps } = setup();
    const { observer } = recordingObserver();

    await expect(
      runReferencePipeline({ project, file: FILE }, deps, observer, {
        measurements: createFakeReferenceMeasurements({ probe: { width: 0, height: 0 } }),
      }),
    ).rejects.toMatchObject({ code: 'REFERENCE_FILE_INVALID', stage: 'probe', resource: FILE });
  });

  it('stops with the cancellation error and writes no brief when canceled before persisting', async () => {
    const { deps, storage } = setup();
    const { observer } = recordingObserver('keyframes');

    await expect(
      runReferencePipeline({ project, file: FILE }, deps, observer, { measurements: createFakeReferenceMeasurements() }),
    ).rejects.toBeInstanceOf(ReferencePipelineCanceledError);
    expect(await storage.stat(`${PROJECT_ROOT}/work/reference/modelo.brief.json`)).toBeNull();
  });
});
