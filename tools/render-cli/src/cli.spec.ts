import type { Catalog, CatalogAsset } from '@video-maker/auto-montage';
import { CATALOG_SCHEMA_VERSION } from '@video-maker/auto-montage';
import type { ResolvedBinaries } from '@video-maker/media-local';
import { BinaryNotFoundError, FixtureCommandRunner } from '@video-maker/media-local';
import type { MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createFakeCliDependencies, createFakeFileSystem } from './__fixtures__/fake-cli-dependencies';
import { fixtureMediaProject } from './__fixtures__/media-project';
import { runCli } from './cli';

const identityResolveProjectRoot = (raw: string): string => raw;

const BINARIES: ResolvedBinaries = {
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  whisperCli: 'whisper-cli',
  whisperModel: '/models/ggml-base.bin',
};

const VIDEO_STDOUT = JSON.stringify({
  streams: [
    {
      index: 0,
      codec_name: 'h264',
      codec_type: 'video',
      width: 1280,
      height: 720,
      r_frame_rate: '30/1',
      avg_frame_rate: '30/1',
      duration: '5.000000',
    },
  ],
  format: { filename: 'clip01.mp4', format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '5.000000' },
});

const WHISPER_RAW_OUTPUT = JSON.stringify({
  transcription: [
    { offsets: { from: 0, to: 500 }, text: ' Hola' },
    { offsets: { from: 520, to: 900 }, text: ' mundo' },
  ],
});

function buildIngestableFileSystem() {
  return createFakeFileSystem([
    {
      path: `${fixtureMediaProject.rawDir}/aroll/clip01.mp4`,
      contents: 'contenido-del-clip',
      sizeBytes: 12_345,
      modifiedAtMs: 1_700_000_000_000,
    },
    {
      path: `${fixtureMediaProject.workDir}/whisper/aroll/clip01.json`,
      contents: WHISPER_RAW_OUTPUT,
    },
  ]);
}

function successfulRunner(): FixtureCommandRunner {
  return new FixtureCommandRunner([
    { bin: 'ffprobe', response: { stdout: VIDEO_STDOUT, exitCode: 0 } },
    { bin: 'ffmpeg', response: { exitCode: 0 } },
    { bin: 'whisper-cli', response: { exitCode: 0 } },
  ]);
}

function videoAsset(init: Partial<MediaAsset> & Pick<MediaAsset, 'id' | 'path'>): MediaAsset {
  return {
    kind: 'video',
    durationMs: 8000,
    fps: 30,
    width: 1280,
    height: 720,
    hasAudio: false,
    probedAt: '2026-01-01T00:00:00.000Z',
    ...init,
  };
}

function buildCatalogWithoutAroll() {
  const brollAsset = videoAsset({ id: 'raw/broll/terminal.mp4', path: 'raw/broll/terminal.mp4' });
  const catalogAsset: CatalogAsset = {
    role: 'broll',
    fingerprint: { sizeBytes: 1000, modifiedAtMs: 0 },
    asset: brollAsset,
  };
  const catalog: Catalog = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    projectSlug: fixtureMediaProject.slug,
    assets: [catalogAsset],
    transcripts: [],
    ignored: [],
    probeFailures: [],
  };

  return createFakeFileSystem([{ path: `${fixtureMediaProject.workDir}/catalog.json`, contents: JSON.stringify(catalog) }]);
}

describe('runCli — success', () => {
  it('returns exitCode 0, formatted stdout and empty stderr for a successful ingest', async () => {
    const deps = createFakeCliDependencies({
      fileSystem: buildIngestableFileSystem(),
      runner: successfulRunner(),
      resolveBinaries: async () => BINARIES,
    });

    const outcome = await runCli(['ingest', fixtureMediaProject.root], identityResolveProjectRoot, deps);

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).toEqual([]);
    expect(outcome.stdout[0]).toBe('ok [ingest] work/catalog.json');
  });
});

describe('runCli — exit 2, CLI_USAGE / CLI_ARGUMENT', () => {
  it('missing-command with no argv at all', async () => {
    const deps = createFakeCliDependencies();

    const outcome = await runCli([], identityResolveProjectRoot, deps);

    expect(outcome.exitCode).toBe(2);
    expect(outcome.stdout).toEqual([]);
    expect(outcome.stderr[0]).toBe('error [uso] missing-command');
  });

  it('unknown-command', async () => {
    const deps = createFakeCliDependencies();

    const outcome = await runCli(['rnder', fixtureMediaProject.root], identityResolveProjectRoot, deps);

    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr[0]).toBe('error [uso] unknown-command');
  });

  it('unexpected-option: --preset on ingest', async () => {
    const deps = createFakeCliDependencies();

    const outcome = await runCli(
      ['ingest', fixtureMediaProject.root, '--preset', 'hardware'],
      identityResolveProjectRoot,
      deps,
    );

    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr[0]).toBe('error [uso] unexpected-option');
  });

  it('missing-preset on plan', async () => {
    const deps = createFakeCliDependencies();

    const outcome = await runCli(['plan', fixtureMediaProject.root], identityResolveProjectRoot, deps);

    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr[0]).toBe('error [plan] missing-preset');
  });

  it('unknown-preset on plan', async () => {
    const deps = createFakeCliDependencies();

    const outcome = await runCli(
      ['plan', fixtureMediaProject.root, '--preset', 'bogus'],
      identityResolveProjectRoot,
      deps,
    );

    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr[0]).toBe('error [plan] unknown-preset');
  });

  it('invalid-seed on plan', async () => {
    const deps = createFakeCliDependencies();

    const outcome = await runCli(
      ['plan', fixtureMediaProject.root, '--preset', 'hardware', '--seed=-1'],
      identityResolveProjectRoot,
      deps,
    );

    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr[0]).toBe('error [plan] invalid-seed');
  });
});

describe('runCli — exit 3, STAGE_INPUT_MISSING', () => {
  it('project-root-not-found on ingest', async () => {
    const deps = createFakeCliDependencies({ fileSystem: createFakeFileSystem([]) });

    const outcome = await runCli(['ingest', fixtureMediaProject.root], identityResolveProjectRoot, deps);

    expect(outcome.exitCode).toBe(3);
    expect(outcome.stdout).toEqual([]);
    expect(outcome.stderr[0]).toBe('error [ingest] project-root-not-found');
  });

  it('catalog-missing on plan', async () => {
    const deps = createFakeCliDependencies({ fileSystem: createFakeFileSystem([]) });

    const outcome = await runCli(
      ['plan', fixtureMediaProject.root, '--preset', 'hardware'],
      identityResolveProjectRoot,
      deps,
    );

    expect(outcome.exitCode).toBe(3);
    expect(outcome.stderr[0]).toBe('error [plan] catalog-missing');
  });

  it('timeline-missing on render', async () => {
    const deps = createFakeCliDependencies({ fileSystem: createFakeFileSystem([]) });

    const outcome = await runCli(['render', fixtureMediaProject.root], identityResolveProjectRoot, deps);

    expect(outcome.exitCode).toBe(3);
    expect(outcome.stderr[0]).toBe('error [render] timeline-missing');
  });
});

describe('runCli — exit 4, STAGE_FAILED stage ingest', () => {
  it('BINARY_NOT_FOUND from resolveBinaries', async () => {
    const deps = createFakeCliDependencies({
      fileSystem: buildIngestableFileSystem(),
      resolveBinaries: async () => {
        throw new BinaryNotFoundError({ binary: 'whisper-cli' });
      },
    });

    const outcome = await runCli(['ingest', fixtureMediaProject.root], identityResolveProjectRoot, deps);

    expect(outcome.exitCode).toBe(4);
    expect(outcome.stderr[0]).toBe('error [ingest] BINARY_NOT_FOUND');
  });
});

describe('runCli — exit 5, STAGE_FAILED stage plan', () => {
  it('MONTAGE_INPUT_INVALID when the catalog has no aroll asset', async () => {
    const deps = createFakeCliDependencies({ fileSystem: buildCatalogWithoutAroll() });

    const outcome = await runCli(
      ['plan', fixtureMediaProject.root, '--preset', 'software-demo'],
      identityResolveProjectRoot,
      deps,
    );

    expect(outcome.exitCode).toBe(5);
    expect(outcome.stderr[0]).toBe('error [plan] MONTAGE_INPUT_INVALID');
  });
});

describe('runCli — exit 6, STAGE_FAILED stage render', () => {
  it('TIMELINE_UNREADABLE when work/timeline.json is broken JSON', async () => {
    const deps = createFakeCliDependencies({
      fileSystem: createFakeFileSystem([
        { path: `${fixtureMediaProject.workDir}/timeline.json`, contents: '{ not json' },
      ]),
    });

    const outcome = await runCli(['render', fixtureMediaProject.root], identityResolveProjectRoot, deps);

    expect(outcome.exitCode).toBe(6);
    expect(outcome.stderr[0]).toBe('error [render] TIMELINE_UNREADABLE');
  });
});

describe('runCli — exit 1, untyped error', () => {
  it('never prints a stack, only [interno] <name>: <message>', async () => {
    const validTimeline = {
      schemaVersion: 1,
      id: 'timeline-1',
      format: { preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 },
      durationFrames: 30,
      assets: [],
      tracks: { aroll: [], broll: [], voice: [], music: [], captions: [] },
      audioMix: { voice: {}, music: {}, automation: [] },
    };
    const deps = createFakeCliDependencies({
      fileSystem: createFakeFileSystem([
        { path: `${fixtureMediaProject.workDir}/timeline.json`, contents: JSON.stringify(validTimeline) },
      ]),
      renderTimeline: async () => {
        throw new TypeError("Cannot read properties of undefined (reading 'assets')");
      },
    });

    const outcome = await runCli(['render', fixtureMediaProject.root], identityResolveProjectRoot, deps);

    expect(outcome.exitCode).toBe(1);
    expect(outcome.stdout).toEqual([]);
    expect(outcome.stderr).toEqual([
      "error [interno] TypeError: Cannot read properties of undefined (reading 'assets')",
    ]);
    outcome.stderr.forEach((line) => expect(line).not.toMatch(/^\s*at /));
  });
});

describe('runCli — run propagates the failing stage, never "run" (RN-21)', () => {
  it('a missing project root fails at ingest with exit 3', async () => {
    const deps = createFakeCliDependencies({ fileSystem: createFakeFileSystem([]) });

    const outcome = await runCli(
      ['run', fixtureMediaProject.root, '--preset', 'hardware'],
      identityResolveProjectRoot,
      deps,
    );

    expect(outcome.exitCode).toBe(3);
    expect(outcome.stderr[0]).toBe('error [ingest] project-root-not-found');
  });
});
