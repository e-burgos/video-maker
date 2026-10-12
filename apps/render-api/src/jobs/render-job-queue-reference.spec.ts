import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeReferenceMeasurements } from '../__fixtures__/fake-reference-measurements';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { createRenderJobQueue } from './render-job-queue';

const PROJECT_ROOT = '/media/demo';

function queueWithReference(hasFile: boolean) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: [PROJECT_ROOT],
    files: hasFile ? [{ path: `${PROJECT_ROOT}/raw/reference/modelo.mp4`, contents: 'video' }] : [],
  });
  const deps = createFakeRenderApiDependencies(callLog, { storage });
  deps.localStore.projects.insert('demo', null, 'footage');
  const queue = createRenderJobQueue(deps, undefined, undefined, {}, {}, { measurements: createFakeReferenceMeasurements() });
  return { queue, storage };
}

describe('reference jobs in the queue', () => {
  it('runs a reference job to success with a report and the brief on disk', async () => {
    const { queue, storage } = queueWithReference(true);

    const job = queue.create({ kind: 'reference', slug: 'demo', projectRoot: PROJECT_ROOT, file: 'raw/reference/modelo.mp4' });
    await queue.whenIdle();

    expect(queue.get(job.id)).toMatchObject({
      kind: 'reference',
      state: 'succeeded',
      progress: { stage: 'persist', percent: 100 },
      report: { name: 'modelo', briefFile: 'work/reference/modelo.brief.json', scenes: 3 },
    });
    expect(await storage.stat(`${PROJECT_ROOT}/work/reference/modelo.brief.json`)).not.toBeNull();
    expect(queue.listBySlug('demo').map((entry) => entry.kind)).toEqual(['reference']);
  });

  it('does not queue a review after a reference job', async () => {
    const { queue } = queueWithReference(true);

    queue.create({ kind: 'reference', slug: 'demo', projectRoot: PROJECT_ROOT, file: 'raw/reference/modelo.mp4' });
    await queue.whenIdle();

    expect(queue.listBySlug('demo').some((job) => job.kind === 'review')).toBe(false);
  });
});
