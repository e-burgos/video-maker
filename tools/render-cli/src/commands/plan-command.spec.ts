import type { Catalog, CatalogAsset, MontagePresetName } from '@video-maker/auto-montage';
import { CATALOG_SCHEMA_VERSION } from '@video-maker/auto-montage';
import type { MediaAsset } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { createFakeCliDependencies, createFakeFileSystem } from '../__fixtures__/fake-cli-dependencies';
import { fixtureMediaProject } from '../__fixtures__/media-project';
import { StageFailedError } from '../errors/stage-failed-error';
import { StageInputMissingError } from '../errors/stage-input-missing-error';

import { planCommand } from './plan-command';

function videoAsset(init: Partial<MediaAsset> & Pick<MediaAsset, 'id' | 'path'>): MediaAsset {
  return {
    kind: 'video',
    durationMs: 12_000,
    fps: 30,
    width: 1080,
    height: 1920,
    hasAudio: true,
    probedAt: '2026-01-01T00:00:00.000Z',
    ...init,
  };
}

function word(text: string, startMs: number, endMs: number) {
  return { text, startMs, endMs };
}

function buildPlannableFileSystem() {
  const arollAsset = videoAsset({ id: 'raw/aroll/demo.mp4', path: 'raw/aroll/demo.mp4' });
  const catalogAsset: CatalogAsset = {
    role: 'aroll',
    fingerprint: { sizeBytes: 1000, modifiedAtMs: 0 },
    asset: arollAsset,
  };
  const catalog: Catalog = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    projectSlug: fixtureMediaProject.slug,
    assets: [catalogAsset],
    transcripts: [
      {
        assetId: arollAsset.id,
        transcriptPath: 'work/transcripts/aroll/demo.json',
        fingerprint: { sizeBytes: 1000, modifiedAtMs: 0 },
        engine: 'whisper.cpp',
        model: 'base',
        language: 'es',
      },
    ],
    ignored: [],
    probeFailures: [],
  };
  const transcription = {
    assetId: arollAsset.id,
    engine: 'whisper.cpp' as const,
    language: 'es',
    words: [
      word('hola', 0, 300),
      word('vamos', 300, 600),
      word('a', 600, 700),
      word('abrir', 700, 1000),
      word('la', 1600, 1700),
      word('terminal', 1700, 2200),
      word('y', 2200, 2300),
      word('ejecutamos', 2300, 2800),
      word('el', 2900, 3000),
      word('comando', 3000, 3500),
      word('listo', 3500, 3800),
    ],
    segments: [],
  };

  return createFakeFileSystem([
    { path: `${fixtureMediaProject.workDir}/catalog.json`, contents: JSON.stringify(catalog) },
    {
      path: `${fixtureMediaProject.workDir}/transcripts/aroll/demo.json`,
      contents: JSON.stringify(transcription),
    },
  ]);
}

describe('planCommand', () => {
  it('propagates assertCatalogExists when work/catalog.json is missing', async () => {
    const deps = createFakeCliDependencies({ fileSystem: createFakeFileSystem([]) });

    await expect(
      planCommand(fixtureMediaProject, { preset: 'software-demo', seed: 0, scriptPath: null, logo: 'auto', format: 'reels-9x16' }, deps),
    ).rejects.toBeInstanceOf(StageInputMissingError);
  });

  it('runs autoMontage for real and maps the result to a PlanReport, resolving even with broll rejections (RN-28)', async () => {
    const deps = createFakeCliDependencies({ fileSystem: buildPlannableFileSystem() });

    const report = await planCommand(fixtureMediaProject, { preset: 'software-demo', seed: 42, scriptPath: null, logo: 'auto', format: 'reels-9x16' }, deps);

    expect(report.kind).toBe('plan');
    expect(report.timelinePath).toBe('work/timeline.json');
    expect(report.edlPath).toBe('work/edl.json');
    expect(report.editedDurationMs).toBeGreaterThan(0);
    expect(Array.isArray(report.brollRejections)).toBe(true);
  });

  it('planifica en el formato pedido y por defecto en vertical', async () => {
    const deps = createFakeCliDependencies({ fileSystem: buildPlannableFileSystem() });

    const vertical = await planCommand(
      fixtureMediaProject,
      { preset: 'software-demo', seed: 0, scriptPath: null, logo: 'auto', format: 'reels-9x16' },
      deps,
    );
    const landscape = await planCommand(
      fixtureMediaProject,
      { preset: 'software-demo', seed: 0, scriptPath: null, logo: 'auto', format: 'youtube-16x9' },
      deps,
    );

    expect(vertical.format).toEqual({ preset: 'reels-9x16', width: 1080, height: 1920, fps: 30 });
    expect(landscape.format).toEqual({ preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 });
  });

  it('translates a thrown MontageInputError to a StageFailedError with stage plan (RN-26)', async () => {
    const deps = createFakeCliDependencies({ fileSystem: buildPlannableFileSystem() });

    const error = await planCommand(
      fixtureMediaProject,
      { preset: 'unknown-preset-value' as MontagePresetName, seed: 0, scriptPath: null, logo: 'auto', format: 'reels-9x16' },
      deps,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageFailedError);
    expect((error as StageFailedError).stage).toBe('plan');
    expect((error as StageFailedError).reason).toBe('MONTAGE_INPUT_INVALID');
  });

  it('con --script corrige las captions contra el guion y lo reporta (spec-014)', async () => {
    const fileSystem = buildPlannableFileSystem();
    await fileSystem.writeTextFile(
      '/tmp/script.txt',
      'hola vamos a abrir la terminal y ejecutamos el cómputo listo',
    );
    const deps = createFakeCliDependencies({ fileSystem });

    const report = await planCommand(
      fixtureMediaProject,
      { preset: 'software-demo', seed: 42, scriptPath: '/tmp/script.txt', logo: 'auto', format: 'reels-9x16' },
      deps,
    );

    expect(report.scriptAlignment).toEqual({
      replaced: 1,
      removed: 0,
      inserted: 0,
      dropped: 0,
      corrected: 1,
    });
    expect(report.logoAssetId).toBeNull();
  });

  it('sin --script no hay reporte de alineación', async () => {
    const deps = createFakeCliDependencies({ fileSystem: buildPlannableFileSystem() });

    const report = await planCommand(
      fixtureMediaProject,
      { preset: 'software-demo', seed: 42, scriptPath: null, logo: 'auto', format: 'reels-9x16' },
      deps,
    );

    expect(report.scriptAlignment).toBeNull();
  });

  it('--voice script planifica sobre el wav sintetizado, sin podar silencios (FIX-e-burgos-007-002)', async () => {
    const fileSystem = buildPlannableFileSystem();
    await fileSystem.writeTextFile(
      `${fixtureMediaProject.workDir}/voice/script-manifest.json`,
      JSON.stringify({
        schemaVersion: 1,
        source: 'script',
        language: 'es',
        voiceId: 'es_AR-daniela-high',
        gapMs: 900,
        path: 'work/voice/voice.wav',
        wordsPath: 'work/voice/voice.words.json',
        durationMs: 9000,
        sampleRate: 48_000,
        updatedAt: '2026-01-01T00:00:00.000Z',
        lines: [
          { index: 1, text: 'abrimos la terminal', path: 'work/voice/sources/line-01.wav', startMs: 0, durationMs: 9000 },
        ],
      }),
    );
    await fileSystem.writeTextFile(
      `${fixtureMediaProject.workDir}/voice/voice.words.json`,
      JSON.stringify({
        assetId: 'work/voice/voice.wav',
        engine: 'whisper.cpp',
        language: 'es',
        words: [
          word('abrimos', 0, 600),
          word('la', 600, 800),
          word('terminal', 800, 1400),
          word('escribimos', 2600, 3300),
          word('en', 3300, 3500),
          word('la', 3500, 3700),
          word('terminal', 3700, 4300),
        ],
        segments: [],
      }),
    );
    const deps = createFakeCliDependencies({ fileSystem });

    const report = await planCommand(
      fixtureMediaProject,
      {
        preset: 'software-demo',
        seed: 0,
        scriptPath: null,
        logo: 'auto',
        format: 'youtube-16x9',
        voice: 'script',
        pruneSilences: undefined,
      },
      deps,
    );

    expect(report.voiceSource).toBe('script');
    expect(report.transcriptionSource).toBe('voice-script');
    expect(report.voiceTrack).toEqual({
      assetId: 'work/voice/voice.wav',
      durationMs: 9000,
      truncatedMs: 0,
    });

    const pruned = await planCommand(
      fixtureMediaProject,
      {
        preset: 'software-demo',
        seed: 0,
        scriptPath: null,
        logo: 'auto',
        format: 'youtube-16x9',
        voice: 'script',
        pruneSilences: true,
      },
      deps,
    );

    expect(pruned.editedDurationMs).toBeLessThan(report.editedDurationMs);
  });

  it('un --script que no se puede leer es STAGE_INPUT_MISSING en la etapa plan', async () => {
    const deps = createFakeCliDependencies({ fileSystem: buildPlannableFileSystem() });

    const error = await planCommand(
      fixtureMediaProject,
      { preset: 'software-demo', seed: 0, scriptPath: '/tmp/no-existe.txt', logo: 'auto', format: 'reels-9x16' },
      deps,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StageInputMissingError);
    expect((error as StageInputMissingError).stage).toBe('plan');
    expect((error as StageInputMissingError).reason).toBe('script-missing');
  });
});
