import type { ReferenceBrief } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import type { StoreConfig } from '../../config/store-config';
import { handleGetReference, handleListReferences } from './references-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets', brandsRoot: '/brands' };
const WORK = `${STORE.mediaRoot}/demo/work/reference`;

const BRIEF: ReferenceBrief = {
  version: 1,
  file: 'raw/reference/modelo.mp4',
  durationSec: 30,
  format: { width: 1080, height: 1920, fps: 30, orientation: 'portrait' },
  scenes: [{ index: 0, startSec: 0, endSec: 30, durationSec: 30, keyframe: 'work/reference/modelo/scene-00.jpg' }],
  pace: { cutsPerMinute: 0, meanSceneSec: 30, medianSceneSec: 30 },
  voice: null,
  audio: { integratedLufs: -14, longSilences: [] },
  summary: 'Referencia de prueba.',
  createdAt: '2026-10-12T10:00:00.000Z',
};

function harness(files: Array<{ path: string; contents: string }>) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/demo`, WORK], files });
  const deps = createFakeRenderApiDependencies(callLog, { storage });
  deps.localStore.projects.insert('demo', null, 'footage');
  return deps;
}

describe('handleListReferences', () => {
  it('lists the stored briefs as summaries, ignoring files that are not valid briefs', async () => {
    const deps = harness([
      { path: `${WORK}/modelo.brief.json`, contents: JSON.stringify(BRIEF) },
      { path: `${WORK}/roto.brief.json`, contents: '{ not json' },
      { path: `${WORK}/modelo.wav`, contents: 'wav' },
    ]);

    const response = await handleListReferences(deps, STORE, { slug: 'demo' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      references: [
        {
          name: 'modelo',
          file: 'raw/reference/modelo.mp4',
          briefFile: 'work/reference/modelo.brief.json',
          durationSec: 30,
          scenes: 1,
          cutsPerMinute: 0,
          hasVoice: false,
          summary: 'Referencia de prueba.',
          createdAt: '2026-10-12T10:00:00.000Z',
        },
      ],
    });
  });

  it('answers an empty list when nothing was analysed', async () => {
    const response = await handleListReferences(harness([]), STORE, { slug: 'demo' });

    expect(response.body).toEqual({ references: [] });
  });
});

describe('handleGetReference', () => {
  it('returns the full brief', async () => {
    const deps = harness([{ path: `${WORK}/modelo.brief.json`, contents: JSON.stringify(BRIEF) }]);

    const response = await handleGetReference(deps, STORE, { slug: 'demo', name: 'modelo' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(BRIEF);
  });

  it('answers REFERENCE_NOT_FOUND for an unknown or unsafe name', async () => {
    const deps = harness([]);

    for (const name of ['nope', '../x', '']) {
      await expect(handleGetReference(deps, STORE, { slug: 'demo', name })).rejects.toMatchObject({
        code: 'REFERENCE_NOT_FOUND',
      });
    }
  });
});
