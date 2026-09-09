import { resolveMediaProject } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import type { StoreConfig } from '../config/store-config';
import { assertTimelineNotPersisted, readStoredTimeline, resolveExistingProject } from './project-scope';

const MEDIA_ROOT = '/media';
const SLUG = 'smoke-ingest';
const PROJECT_ROOT = `${MEDIA_ROOT}/${SLUG}`;
const STORE: StoreConfig = { mediaRoot: MEDIA_ROOT, maxUploadBytes: 2_147_483_648, objectStore: 'fs' };

describe('readStoredTimeline', () => {
  it('reads and parses work/timeline.json with a single readTextFile', async () => {
    const callLog = createCallLog();
    const timeline = buildMinimalTimeline();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/work/timeline.json`, contents: JSON.stringify(timeline) }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const project = resolveMediaProject(PROJECT_ROOT);

    const result = await readStoredTimeline(deps, project);

    expect(result).toEqual(timeline);
    expect(callLog.ports()).toEqual(['stat', 'readTextFile']);
  });

  it('throws TIMELINE_NOT_FOUND when the document is absent and TIMELINE_INVALID when it does not validate', async () => {
    const project = resolveMediaProject(PROJECT_ROOT);

    const missingCallLog = createCallLog();
    const missingStorage = createFakeObjectStorage(missingCallLog, { directories: [PROJECT_ROOT] });
    const missingDeps = createFakeRenderApiDependencies(missingCallLog, { storage: missingStorage });

    await expect(readStoredTimeline(missingDeps, project)).rejects.toMatchObject({ code: 'TIMELINE_NOT_FOUND' });

    const invalidCallLog = createCallLog();
    const invalidStorage = createFakeObjectStorage(invalidCallLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/work/timeline.json`, contents: JSON.stringify({ not: 'valid' }) }],
    });
    const invalidDeps = createFakeRenderApiDependencies(invalidCallLog, { storage: invalidStorage });

    await expect(readStoredTimeline(invalidDeps, project)).rejects.toMatchObject({ code: 'TIMELINE_INVALID' });
  });
});

describe('resolveExistingProject', () => {
  it('throws PROJECT_NOT_FOUND when the project root is missing or is not a directory', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      files: [{ path: PROJECT_ROOT, contents: 'not-a-directory' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(resolveExistingProject(deps, STORE, 'missing-project')).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
    await expect(resolveExistingProject(deps, STORE, SLUG)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});

describe('assertTimelineNotPersisted', () => {
  it('does not throw when overwrite is false and no timeline is stored yet', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [PROJECT_ROOT] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const project = resolveMediaProject(PROJECT_ROOT);

    await expect(assertTimelineNotPersisted(deps, project, false)).resolves.toBeUndefined();
    expect(callLog.ports()).toEqual(['stat']);
  });

  it('throws TIMELINE_ALREADY_EXISTS with the project-relative resource when a valid timeline is already stored', async () => {
    const callLog = createCallLog();
    const timeline = buildMinimalTimeline();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/work/timeline.json`, contents: JSON.stringify(timeline) }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const project = resolveMediaProject(PROJECT_ROOT);

    await expect(assertTimelineNotPersisted(deps, project, false)).rejects.toMatchObject({
      code: 'TIMELINE_ALREADY_EXISTS',
      resource: 'work/timeline.json',
    });
  });

  it('throws TIMELINE_ALREADY_EXISTS even when the stored document is corrupt, because it never parses it', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/work/timeline.json`, contents: '{ this is not valid json' }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const project = resolveMediaProject(PROJECT_ROOT);

    await expect(assertTimelineNotPersisted(deps, project, false)).rejects.toMatchObject({
      code: 'TIMELINE_ALREADY_EXISTS',
      resource: 'work/timeline.json',
    });
    expect(callLog.ports()).toEqual(['stat']);
  });

  it('never calls readTextFile: it answers the existence question with a stat alone', async () => {
    const callLog = createCallLog();
    const timeline = buildMinimalTimeline();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/work/timeline.json`, contents: JSON.stringify(timeline) }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const project = resolveMediaProject(PROJECT_ROOT);

    await expect(assertTimelineNotPersisted(deps, project, false)).rejects.toMatchObject({
      code: 'TIMELINE_ALREADY_EXISTS',
    });
    expect(callLog.ports()).not.toContain('readTextFile');
  });

  it('never calls stat when overwrite is true, regardless of whether a timeline is already stored', async () => {
    const callLog = createCallLog();
    const timeline = buildMinimalTimeline();
    const storage = createFakeObjectStorage(callLog, {
      directories: [PROJECT_ROOT],
      files: [{ path: `${PROJECT_ROOT}/work/timeline.json`, contents: JSON.stringify(timeline) }],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const project = resolveMediaProject(PROJECT_ROOT);

    await expect(assertTimelineNotPersisted(deps, project, true)).resolves.toBeUndefined();
    expect(callLog.ports()).toEqual([]);
  });
});
