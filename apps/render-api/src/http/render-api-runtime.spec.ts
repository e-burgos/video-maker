import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import { createRenderApiRuntime } from './render-api-runtime';

describe('createRenderApiRuntime', () => {
  it('keeps independent in-memory scheduling per runtime while sharing the persisted job store', async () => {
    const callLog = createCallLog();
    const deps = createFakeRenderApiDependencies(callLog);
    deps.localStore.projects.insert('acme-launch');

    const first = createRenderApiRuntime(deps);
    const second = createRenderApiRuntime(deps);

    const job = first.jobs.create({
      kind: 'render',
      slug: 'acme-launch',
      projectRoot: '/var/data/media/acme-launch',
      timeline: buildMinimalTimeline(),
    });

    expect(first.jobs.get(job.id)).not.toBeNull();
    expect(second.jobs.get(job.id)).not.toBeNull();
    expect(second.jobs.size()).toEqual({ running: 0, queued: 0 });
    expect(first.uploadSerializer).not.toBe(second.uploadSerializer);

    await first.jobs.whenIdle();
  });
});
