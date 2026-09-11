import { describe, expect, it } from 'vitest';

import { voiceDocument, voiceJob, voiceTrack, VOICE_MODELS } from './__fixtures__/voice';
import { parseVoiceJob, showsSceneProgress } from './parse-render-job';
import {
  parseVoiceDocument,
  parseVoiceListing,
  parseVoiceSceneWriteResult,
} from './parse-voice';
import { RenderApiError } from './render-api-error';
import type { VoiceJobReport } from './render-api-types';

function expectShapeRefusal(run: () => unknown): void {
  expect(run).toThrowError(RenderApiError);
  try {
    run();
  } catch (cause) {
    expect((cause as RenderApiError).code).toBe('RESPONSE_SHAPE_UNEXPECTED');
  }
}

describe('parseVoiceListing', () => {
  it('accepts the exact payload EP-019 publishes', () => {
    const listing = parseVoiceListing(JSON.parse(JSON.stringify(VOICE_MODELS)));
    expect(Object.keys(listing).sort()).toEqual(['voices']);
    expect(Object.keys(listing.voices[0] as object).sort()).toEqual([
      'fileName',
      'id',
      'isDefault',
    ]);
  });

  it('accepts an empty catalogue, which is not the same as Piper being unconfigured', () => {
    expect(parseVoiceListing({ voices: [] }).voices).toEqual([]);
  });

  it('refuses a voice without its isDefault flag', () => {
    expectShapeRefusal(() =>
      parseVoiceListing({ voices: [{ id: 'a', fileName: 'a.onnx' }] }),
    );
  });
});

describe('parseVoiceDocument', () => {
  it('accepts the exact payload EP-020 publishes', () => {
    const document = parseVoiceDocument(JSON.parse(JSON.stringify(voiceDocument())));
    expect(Object.keys(document).sort()).toEqual(['manifest', 'scenes', 'slug']);
    expect(Object.keys(document.manifest).sort()).toEqual([
      'language',
      'schemaVersion',
      'storyboardId',
      'tracks',
    ]);
    expect(Object.keys(document.manifest.tracks[0] as object).sort()).toEqual([
      'durationMs',
      'index',
      'narrationHash',
      'path',
      'sampleRate',
      'sceneId',
      'source',
      'updatedAt',
      'voiceId',
      'wordsPath',
    ]);
    expect(Object.keys(document.scenes[0] as object).sort()).toEqual([
      'index',
      'sceneId',
      'source',
      'stale',
    ]);
  });

  it('accepts an uploaded track, whose voiceId is null by contract', () => {
    const uploaded = voiceDocument({
      manifest: {
        schemaVersion: 1,
        storyboardId: 'sb',
        language: 'es-AR',
        tracks: [voiceTrack({ source: 'uploaded', voiceId: null })],
      },
      scenes: [{ sceneId: 'scene-01', index: 1, source: 'uploaded', stale: null }],
    });
    expect(parseVoiceDocument(uploaded).manifest.tracks[0]?.voiceId).toBeNull();
  });

  it('refuses a scene whose source is not one of the two the manifest allows', () => {
    const broken = voiceDocument();
    expectShapeRefusal(() =>
      parseVoiceDocument({
        ...broken,
        scenes: [{ sceneId: 'scene-01', index: 1, source: 'recorded', stale: false }],
      }),
    );
  });

  it('refuses a track without its measured duration', () => {
    const track = voiceTrack() as unknown as Record<string, unknown>;
    delete track['durationMs'];
    expectShapeRefusal(() =>
      parseVoiceDocument({
        slug: 's',
        manifest: { schemaVersion: 1, storyboardId: 'sb', language: 'es-AR', tracks: [track] },
        scenes: [],
      }),
    );
  });
});

describe('parseVoiceSceneWriteResult', () => {
  it('accepts the exact payload EP-021 publishes', () => {
    const written = parseVoiceSceneWriteResult({
      slug: 'smoke-ingest',
      path: 'work/voice/manifest.json',
      track: voiceTrack({ source: 'uploaded', voiceId: null }),
    });
    expect(Object.keys(written).sort()).toEqual(['path', 'slug', 'track']);
    expect(written.track.source).toBe('uploaded');
  });

  it('refuses a result without the stored track', () => {
    expectShapeRefusal(() =>
      parseVoiceSceneWriteResult({ slug: 's', path: 'work/voice/manifest.json' }),
    );
  });
});

describe('parseVoiceJob', () => {
  it('accepts a voice job with its per-scene progress', () => {
    const job = parseVoiceJob(JSON.parse(JSON.stringify(voiceJob())));
    expect(job.kind).toBe('voice');
    expect(job.progress).toEqual({
      stage: 'synthesize',
      processedScenes: 2,
      totalScenes: 5,
      percent: 40,
    });
  });

  it('accepts the report the service emits when it succeeds', () => {
    const job = parseVoiceJob(
      voiceJob({
        state: 'succeeded',
        progress: { stage: 'persist', processedScenes: null, totalScenes: null, percent: null },
        report: {
          source: 'storyboard',
          track: null,
          manifestPath: 'work/voice/manifest.json',
          storyboardId: 'sb',
          voiceId: 'es_AR-daniela-high',
          language: 'es-AR',
          scenes: [
            {
              sceneId: 'scene-01',
              path: 'work/voice/scene-01.wav',
              wordsPath: 'work/voice/scene-01.words.json',
              durationMs: 3100,
              source: 'generated',
            },
          ],
        },
      }),
    );
    expect(job.report?.scenes).toHaveLength(1);
  });

  it('accepts the script report: no storyboard, one concatenated track (FIX-e-burgos-009-001)', () => {
    const job = parseVoiceJob(
      voiceJob({
        state: 'succeeded',
        progress: { stage: 'persist', processedScenes: null, totalScenes: null, percent: null },
        report: {
          source: 'script',
          manifestPath: 'work/voice/script-manifest.json',
          storyboardId: null,
          voiceId: 'es_AR-daniela-high',
          language: 'es-AR',
          scenes: [],
          track: {
            path: 'work/voice/voice.wav',
            wordsPath: 'work/voice/voice.words.json',
            durationMs: 7800,
            lineCount: 3,
            gapMs: 900,
          },
        },
      }),
    );

    expect(job.report?.source).toBe('script');
    expect(job.report?.storyboardId).toBeNull();
    expect(job.report?.track?.lineCount).toBe(3);
  });

  it('refuses a report with an unknown source or a malformed track', () => {
    expectShapeRefusal(() =>
      parseVoiceJob(
        voiceJob({
          state: 'succeeded',
          report: {
            source: 'freestyle',
            manifestPath: 'work/voice/manifest.json',
            storyboardId: null,
            voiceId: 'v',
            language: 'es-AR',
            scenes: [],
            track: null,
          } as unknown as VoiceJobReport,
        }),
      ),
    );
    expectShapeRefusal(() =>
      parseVoiceJob(
        voiceJob({
          state: 'succeeded',
          report: {
            source: 'script',
            manifestPath: 'work/voice/script-manifest.json',
            storyboardId: null,
            voiceId: 'v',
            language: 'es-AR',
            scenes: [],
            track: { path: 'work/voice/voice.wav' },
          } as unknown as VoiceJobReport,
        }),
      ),
    );
  });

  it('refuses a job of any other kind', () => {
    expectShapeRefusal(() => parseVoiceJob({ ...voiceJob(), kind: 'storyboard', progress: null }));
  });

  it('refuses a progress whose stage belongs to another pipeline', () => {
    expectShapeRefusal(() =>
      parseVoiceJob(
        voiceJob({
          progress: {
            stage: 'render',
            processedScenes: null,
            totalScenes: null,
            percent: null,
          } as never,
        }),
      ),
    );
  });
});

describe('showsSceneProgress', () => {
  it('is true only once the service counted the scenes', () => {
    expect(
      showsSceneProgress({
        stage: 'synthesize',
        processedScenes: 1,
        totalScenes: 5,
        percent: 20,
      }),
    ).toBe(true);
    expect(
      showsSceneProgress({
        stage: 'persist',
        processedScenes: null,
        totalScenes: null,
        percent: null,
      }),
    ).toBe(false);
    expect(showsSceneProgress(null)).toBe(false);
  });
});
