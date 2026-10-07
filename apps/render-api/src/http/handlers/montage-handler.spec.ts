import { resolveMediaProject, writeEditDecisionList, writeTimeline } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../../__fixtures__/call-log';
import { createFakeObjectStorage } from '../../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../../__fixtures__/fake-render-api-dependencies';
import { requestLine } from '../../__fixtures__/http-request';
import { buildMinimalEditDecisionList } from '../../__fixtures__/minimal-edit-decision-list';
import { buildMinimalTimeline } from '../../__fixtures__/minimal-timeline';
import type { StoreConfig } from '../../config/store-config';
import { toErrorPayload } from '../../errors/to-error-payload';
import {
  handleGetEditDecisionList,
  handleGetTimeline,
  handlePutEditDecisionList,
  handlePutTimeline,
} from './montage-handler';

const STORE: StoreConfig = { mediaRoot: '/media', dbPath: '/media/.studio/studio.db', maxUploadBytes: 2_147_483_648, objectStore: 'fs', motionAssetsRoot: '/repo/libs/motion-graphics/assets' };

async function* jsonBody(value: unknown): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(JSON.stringify(value));
}

async function* textBody(value: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(value);
}

async function caughtErrorPayload(promise: Promise<unknown>): Promise<ReturnType<typeof toErrorPayload>> {
  return promise.then(
    () => {
      throw new Error('expected the handler to reject');
    },
    (error: unknown) => toErrorPayload(error),
  );
}

describe('handlePutTimeline', () => {
  it('writes the timeline with the same bytes writeTimeline produces', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/smoke-ingest`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const timeline = buildMinimalTimeline();
    const request = requestLine({
      method: 'PUT',
      path: '/projects/smoke-ingest/timeline',
      body: jsonBody(timeline),
    });

    await handlePutTimeline(deps, STORE, { slug: 'smoke-ingest' }, request);

    const writeCall = callLog
      .entries()
      .find(
        (entry) =>
          entry.port === 'writeTextFile' &&
          (entry.input as { path: string }).path === `${STORE.mediaRoot}/smoke-ingest/work/timeline.json`,
      );
    if (writeCall === undefined) {
      throw new Error('expected a writeTextFile call for work/timeline.json');
    }
    const capturedContents = (writeCall.input as { contents: string }).contents;

    const referenceContents: string[] = [];
    await writeTimeline(resolveMediaProject(`${STORE.mediaRoot}/smoke-ingest`), timeline, {
      writeTextFile: async (_path, contents) => {
        referenceContents.push(contents);
      },
      ensureDirectory: async () => undefined,
    });

    expect(capturedContents).toBe(referenceContents[0]);
  });

  it('answers 422 TIMELINE_INVALID and writes nothing when the body does not validate', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/smoke-ingest`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const request = requestLine({
      method: 'PUT',
      path: '/projects/smoke-ingest/timeline',
      body: jsonBody({ not: 'a timeline' }),
    });

    await expect(handlePutTimeline(deps, STORE, { slug: 'smoke-ingest' }, request)).rejects.toMatchObject({
      code: 'TIMELINE_INVALID',
    });
    expect(callLog.ports()).not.toContain('writeTextFile');
    expect(callLog.ports()).not.toContain('ensureDirectory');
  });

  it('answers the exact same error for an empty body as for a syntactically invalid one', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/smoke-ingest`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const invalidJsonRequest = requestLine({
      method: 'PUT',
      path: '/projects/smoke-ingest/timeline',
      body: textBody('not json'),
    });
    const emptyBodyRequest = requestLine({ method: 'PUT', path: '/projects/smoke-ingest/timeline' });

    const invalidJsonPayload = await caughtErrorPayload(
      handlePutTimeline(deps, STORE, { slug: 'smoke-ingest' }, invalidJsonRequest),
    );
    const emptyBodyPayload = await caughtErrorPayload(
      handlePutTimeline(deps, STORE, { slug: 'smoke-ingest' }, emptyBodyRequest),
    );

    expect(Object.keys(emptyBodyPayload).sort()).toEqual(Object.keys(invalidJsonPayload).sort());
    expect(emptyBodyPayload).toEqual(invalidJsonPayload);
    expect(emptyBodyPayload.code).toBe('REQUEST_BODY_INVALID_JSON');
  });
});

describe('handlePutEditDecisionList', () => {
  it('writes the edl with the same bytes writeEditDecisionList produces', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/smoke-ingest`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const edl = buildMinimalEditDecisionList();
    const request = requestLine({
      method: 'PUT',
      path: '/projects/smoke-ingest/edl',
      body: jsonBody(edl),
    });

    await handlePutEditDecisionList(deps, STORE, { slug: 'smoke-ingest' }, request);

    const writeCall = callLog
      .entries()
      .find(
        (entry) =>
          entry.port === 'writeTextFile' &&
          (entry.input as { path: string }).path === `${STORE.mediaRoot}/smoke-ingest/work/edl.json`,
      );
    if (writeCall === undefined) {
      throw new Error('expected a writeTextFile call for work/edl.json');
    }
    const capturedContents = (writeCall.input as { contents: string }).contents;

    const referenceContents: string[] = [];
    await writeEditDecisionList(resolveMediaProject(`${STORE.mediaRoot}/smoke-ingest`), edl, {
      writeTextFile: async (_path, contents) => {
        referenceContents.push(contents);
      },
      ensureDirectory: async () => undefined,
    });

    expect(capturedContents).toBe(referenceContents[0]);
  });

  it('answers 422 EDL_INVALID and writes nothing when the body does not validate', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/smoke-ingest`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });
    const request = requestLine({
      method: 'PUT',
      path: '/projects/smoke-ingest/edl',
      body: jsonBody({ not: 'an edl' }),
    });

    await expect(handlePutEditDecisionList(deps, STORE, { slug: 'smoke-ingest' }, request)).rejects.toMatchObject({
      code: 'EDL_INVALID',
    });
    expect(callLog.ports()).not.toContain('writeTextFile');
    expect(callLog.ports()).not.toContain('ensureDirectory');
  });

  it('answers the exact same error for an empty body as for a syntactically invalid one', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/smoke-ingest`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    const invalidJsonRequest = requestLine({
      method: 'PUT',
      path: '/projects/smoke-ingest/edl',
      body: textBody('not json'),
    });
    const emptyBodyRequest = requestLine({ method: 'PUT', path: '/projects/smoke-ingest/edl' });

    const invalidJsonPayload = await caughtErrorPayload(
      handlePutEditDecisionList(deps, STORE, { slug: 'smoke-ingest' }, invalidJsonRequest),
    );
    const emptyBodyPayload = await caughtErrorPayload(
      handlePutEditDecisionList(deps, STORE, { slug: 'smoke-ingest' }, emptyBodyRequest),
    );

    expect(Object.keys(emptyBodyPayload).sort()).toEqual(Object.keys(invalidJsonPayload).sort());
    expect(emptyBodyPayload).toEqual(invalidJsonPayload);
    expect(emptyBodyPayload.code).toBe('REQUEST_BODY_INVALID_JSON');
  });
});

describe('handleGetTimeline', () => {
  it('answers 404 TIMELINE_NOT_FOUND instead of a null body when the file is absent', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, { directories: [`${STORE.mediaRoot}/smoke-ingest`] });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(handleGetTimeline(deps, STORE, { slug: 'smoke-ingest' })).rejects.toMatchObject({
      code: 'TIMELINE_NOT_FOUND',
    });
  });

  it('answers 422 TIMELINE_INVALID when the stored document does not validate', async () => {
    const callLog = createCallLog();
    const storage = createFakeObjectStorage(callLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [
        {
          path: `${STORE.mediaRoot}/smoke-ingest/work/timeline.json`,
          contents: JSON.stringify({ not: 'valid' }),
        },
      ],
    });
    const deps = createFakeRenderApiDependencies(callLog, { storage });

    await expect(handleGetTimeline(deps, STORE, { slug: 'smoke-ingest' })).rejects.toMatchObject({
      code: 'TIMELINE_INVALID',
    });
  });
});

describe('handleGetEditDecisionList', () => {
  it('answers 404 EDL_NOT_FOUND and 422 EDL_INVALID for the stored document', async () => {
    const missingCallLog = createCallLog();
    const missingStorage = createFakeObjectStorage(missingCallLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
    });
    const missingDeps = createFakeRenderApiDependencies(missingCallLog, { storage: missingStorage });
    await expect(handleGetEditDecisionList(missingDeps, STORE, { slug: 'smoke-ingest' })).rejects.toMatchObject({
      code: 'EDL_NOT_FOUND',
    });

    const invalidCallLog = createCallLog();
    const invalidStorage = createFakeObjectStorage(invalidCallLog, {
      directories: [`${STORE.mediaRoot}/smoke-ingest`],
      files: [
        { path: `${STORE.mediaRoot}/smoke-ingest/work/edl.json`, contents: JSON.stringify({ not: 'valid' }) },
      ],
    });
    const invalidDeps = createFakeRenderApiDependencies(invalidCallLog, { storage: invalidStorage });
    await expect(handleGetEditDecisionList(invalidDeps, STORE, { slug: 'smoke-ingest' })).rejects.toMatchObject({
      code: 'EDL_INVALID',
    });
  });
});
