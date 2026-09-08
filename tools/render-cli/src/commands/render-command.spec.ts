import { describe, expect, it } from 'vitest';

import { createFakeCliDependencies, createFakeFileSystem } from '../__fixtures__/fake-cli-dependencies';
import { fixtureMediaProject } from '../__fixtures__/media-project';
import { StageInputMissingError } from '../errors/stage-input-missing-error';
import type { RenderRequest } from '../deps/timeline-renderer';

import { renderCommand } from './render-command';

const VALID_TIMELINE = {
  schemaVersion: 1,
  id: 'timeline-1',
  format: { preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 },
  durationFrames: 556,
  assets: [],
  tracks: { aroll: [], broll: [], voice: [], music: [], captions: [] },
  audioMix: { voice: {}, music: {}, automation: [] },
};

describe('renderCommand', () => {
  it('propagates assertTimelineExists when work/timeline.json is missing', async () => {
    const deps = createFakeCliDependencies({ fileSystem: createFakeFileSystem([]) });

    await expect(renderCommand(fixtureMediaProject, deps)).rejects.toBeInstanceOf(StageInputMissingError);
  });

  it('invokes the TimelineRenderer port with exactly publicDir=project.root and the resolved outPath (CA-014), without a real render', async () => {
    const fileSystem = createFakeFileSystem([
      { path: `${fixtureMediaProject.workDir}/timeline.json`, contents: JSON.stringify(VALID_TIMELINE) },
    ]);

    const receivedRequests: RenderRequest[] = [];
    const deps = createFakeCliDependencies({
      fileSystem,
      renderTimeline: async (_timeline, request) => {
        receivedRequests.push(request);
        return { outPath: request.outPath, width: 1080, height: 1920, fps: 30, durationInFrames: 556 };
      },
    });

    const report = await renderCommand(fixtureMediaProject, deps);

    expect(receivedRequests).toHaveLength(1);
    expect(receivedRequests[0]).toEqual({
      publicDir: fixtureMediaProject.root,
      outPath: `${fixtureMediaProject.outDir}/${fixtureMediaProject.slug}.mp4`,
    });
    expect(receivedRequests[0]?.publicDir).not.toBe(fixtureMediaProject.rawDir);
    expect(report).toEqual({
      kind: 'render',
      outPath: `out/${fixtureMediaProject.slug}.mp4`,
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 556,
    });
  });

  it('propagates a StageFailedError thrown by the render port untouched (the adapter already translated it)', async () => {
    const fileSystem = createFakeFileSystem([
      { path: `${fixtureMediaProject.workDir}/timeline.json`, contents: JSON.stringify(VALID_TIMELINE) },
    ]);
    const renderFailure = new Error('BUNDLE_FAILED');

    const deps = createFakeCliDependencies({
      fileSystem,
      renderTimeline: async () => {
        throw renderFailure;
      },
    });

    await expect(renderCommand(fixtureMediaProject, deps)).rejects.toBe(renderFailure);
  });
});
