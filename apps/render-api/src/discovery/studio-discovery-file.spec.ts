import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  removeStudioDiscoveryFileIfOwned,
  resolveAppVersion,
  resolveStudioSource,
  resolveVideoMakerHome,
  studioDiscoveryFileName,
  writeStudioDiscoveryFile,
} from './studio-discovery-file';
import type { StudioDiscoveryRecord } from './studio-discovery-file';

const RECORD: StudioDiscoveryRecord = {
  apiUrl: 'http://127.0.0.1:4520',
  token: 'secret-token',
  version: '0.4.3',
  source: 'desktop',
  pid: 4242,
  startedAt: '2026-11-12T10:00:00.000Z',
};

describe('studio discovery file', () => {
  let home: string;

  beforeEach(async () => {
    home = join(await mkdtemp(join(tmpdir(), 'vm-discovery-')), 'home');
  });

  afterEach(async () => {
    await rm(join(home, '..'), { recursive: true, force: true });
  });

  it('writes the record with owner-only permissions', async () => {
    const target = await writeStudioDiscoveryFile(home, RECORD);

    expect(target).toBe(join(home, 'studio.desktop.json'));
    expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(RECORD);
    expect((await stat(target)).mode & 0o777).toBe(0o600);
    expect((await stat(home)).mode & 0o777).toBe(0o700);
  });

  it('keeps one file per source', async () => {
    await writeStudioDiscoveryFile(home, RECORD);
    await writeStudioDiscoveryFile(home, { ...RECORD, source: 'dev', pid: 7 });

    expect(JSON.parse(await readFile(join(home, studioDiscoveryFileName('dev')), 'utf8')).pid).toBe(7);
    expect(JSON.parse(await readFile(join(home, studioDiscoveryFileName('desktop')), 'utf8')).pid).toBe(4242);
  });

  it('removes the file only when the pid still owns it', async () => {
    await writeStudioDiscoveryFile(home, RECORD);

    expect(await removeStudioDiscoveryFileIfOwned(home, 'desktop', 1)).toBe(false);
    await expect(stat(join(home, 'studio.desktop.json'))).resolves.toBeDefined();
    expect(await removeStudioDiscoveryFileIfOwned(home, 'desktop', 4242)).toBe(true);
    await expect(stat(join(home, 'studio.desktop.json'))).rejects.toThrow();
  });

  it('does not fail when the file does not exist', async () => {
    expect(await removeStudioDiscoveryFileIfOwned(home, 'dev', 1)).toBe(false);
  });

  it('reads home, source and version from the environment', () => {
    expect(resolveVideoMakerHome({ VIDEO_MAKER_HOME: '/tmp/x' })).toBe('/tmp/x');
    expect(resolveVideoMakerHome({}).endsWith('.video-maker')).toBe(true);
    expect(resolveStudioSource({ VIDEO_MAKER_STUDIO_SOURCE: 'desktop' })).toBe('desktop');
    expect(resolveStudioSource({})).toBe('dev');
    expect(resolveAppVersion({ VIDEO_MAKER_APP_VERSION: '1.2.3' })).toBe('1.2.3');
    expect(resolveAppVersion({})).toBe('0.0.0-dev');
  });
});
