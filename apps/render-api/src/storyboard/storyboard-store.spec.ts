import { resolveMediaProject, serializeMontageDocument } from '@video-maker/auto-montage';
import { describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeObjectStorage } from '../__fixtures__/fake-object-storage';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { buildStoryboardDocument } from '../__fixtures__/storyboard-fixtures';
import { isRenderApiError } from '../errors/render-api-error';
import { storyboardPath } from './storyboard-paths';
import {
  readStoredStoryboard,
  readStoryboardIfUsable,
  storyboardExists,
  writeStoryboard,
} from './storyboard-store';

const PROJECT = resolveMediaProject('/media/acme-launch');
const ABSOLUTE_STORYBOARD = '/media/acme-launch/work/storyboard.json';

function depsWith(contents?: string) {
  const callLog = createCallLog();
  const storage = createFakeObjectStorage(callLog, {
    directories: ['/media/acme-launch', '/media/acme-launch/work'],
    ...(contents === undefined ? {} : { files: [{ path: ABSOLUTE_STORYBOARD, contents }] }),
  });
  return { callLog, storage, deps: createFakeRenderApiDependencies(callLog, { storage }) };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'NO_ERROR_THROWN';
  } catch (error) {
    return isRenderApiError(error) ? error.code : 'NOT_A_RENDER_API_ERROR';
  }
}

describe('storyboardPath', () => {
  it('vive en work/, junto al catálogo y al timeline', () => {
    expect(storyboardPath()).toBe('work/storyboard.json');
  });
});

describe('storyboardExists', () => {
  it('es false sin documento y true con documento', async () => {
    expect(await storyboardExists(depsWith().deps, PROJECT)).toBe(false);
    expect(
      await storyboardExists(depsWith(serializeMontageDocument(buildStoryboardDocument())).deps, PROJECT),
    ).toBe(true);
  });
});

describe('readStoredStoryboard', () => {
  it('devuelve el documento persistido', async () => {
    const document = buildStoryboardDocument();
    const { deps } = depsWith(serializeMontageDocument(document));

    expect(await readStoredStoryboard(deps, PROJECT)).toEqual(document);
  });

  it('reporta STORYBOARD_NOT_FOUND cuando no hay documento', async () => {
    expect(await codeOf(readStoredStoryboard(depsWith().deps, PROJECT))).toBe('STORYBOARD_NOT_FOUND');
  });

  it('reporta STORYBOARD_INVALID cuando el archivo no es JSON', async () => {
    expect(await codeOf(readStoredStoryboard(depsWith('{ roto').deps, PROJECT))).toBe('STORYBOARD_INVALID');
  });

  it('reporta STORYBOARD_INVALID cuando el JSON no valida contra el schema', async () => {
    const broken = { ...buildStoryboardDocument(), scenes: [] };

    expect(await codeOf(readStoredStoryboard(depsWith(JSON.stringify(broken)).deps, PROJECT))).toBe(
      'STORYBOARD_INVALID',
    );
  });
});

describe('writeStoryboard', () => {
  it('escribe con el mismo serializador que el resto de los documentos de work/', async () => {
    const document = buildStoryboardDocument();
    const { deps, storage } = depsWith();

    const relativePath = await writeStoryboard(deps, PROJECT, document);

    expect(relativePath).toBe('work/storyboard.json');
    expect(await storage.readTextFile(ABSOLUTE_STORYBOARD)).toBe(serializeMontageDocument(document));
  });

  it('rechaza persistir un documento que no valida', async () => {
    const { deps } = depsWith();
    const broken = { ...buildStoryboardDocument(), scenes: [] };

    expect(await codeOf(writeStoryboard(deps, PROJECT, broken))).toBe('STORYBOARD_INVALID');
  });

  it('deja el documento escrito legible por readStoredStoryboard', async () => {
    const document = buildStoryboardDocument();
    const { deps } = depsWith();

    await writeStoryboard(deps, PROJECT, document);

    expect(await readStoredStoryboard(deps, PROJECT)).toEqual(document);
  });
});

describe('readStoryboardIfUsable', () => {
  it('devuelve null en vez de fallar cuando el documento falta o está corrupto', async () => {
    expect(await readStoryboardIfUsable(depsWith().deps, PROJECT)).toBeNull();
    expect(await readStoryboardIfUsable(depsWith('{ roto').deps, PROJECT)).toBeNull();
  });

  it('devuelve el documento cuando es usable', async () => {
    const document = buildStoryboardDocument();
    const { deps } = depsWith(serializeMontageDocument(document));

    expect(await readStoryboardIfUsable(deps, PROJECT)).toEqual(document);
  });
});
