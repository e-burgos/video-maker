import { describe, expect, it } from 'vitest';

import { createFakeFileSystem } from '../__fixtures__/fake-file-system';
import { resolveMediaProject } from '../project/media-project';
import { toAbsolutePath } from '../project/project-paths';
import { readVoiceScriptTrack } from './read-voice-script-track';
import { voiceScriptManifestPath, voiceScriptTrackPath, voiceScriptWordsPath } from './voice-script-paths';

const project = resolveMediaProject('/tmp/media/voice-script');

const MANIFEST = {
  schemaVersion: 1,
  source: 'script',
  language: 'es',
  voiceId: 'es_AR-daniela-high',
  gapMs: 900,
  path: voiceScriptTrackPath(),
  wordsPath: voiceScriptWordsPath(),
  durationMs: 9000,
  sampleRate: 48_000,
  updatedAt: '2026-01-01T00:00:00.000Z',
  lines: [
    { index: 1, text: 'abrimos la terminal', path: 'work/voice/sources/line-01.wav', startMs: 0, durationMs: 4000 },
    { index: 2, text: 'y ejecutamos el comando', path: 'work/voice/sources/line-02.wav', startMs: 4900, durationMs: 4100 },
  ],
};

const WORDS = {
  assetId: voiceScriptTrackPath(),
  engine: 'whisper.cpp',
  language: 'es',
  words: [
    { text: 'abrimos', startMs: 0, endMs: 500 },
    { text: 'la', startMs: 500, endMs: 700 },
    { text: 'terminal', startMs: 700, endMs: 1400 },
  ],
  segments: [],
};

function fileSystemWith(manifest: unknown, words: unknown) {
  return createFakeFileSystem([
    { path: toAbsolutePath(project, voiceScriptManifestPath()), contents: JSON.stringify(manifest) },
    { path: toAbsolutePath(project, voiceScriptWordsPath()), contents: JSON.stringify(words) },
  ]);
}

describe('readVoiceScriptTrack (FIX-e-burgos-007-002)', () => {
  it('describe el wav de la voz como un asset de audio propio y devuelve sus palabras', async () => {
    const fileSystem = fileSystemWith(MANIFEST, WORDS);

    const track = await readVoiceScriptTrack(project, { readTextFile: fileSystem.readTextFile });

    expect(track.asset).toEqual({
      id: 'work/voice/voice.wav',
      kind: 'audio',
      path: 'work/voice/voice.wav',
      durationMs: 9000,
      probedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(track.manifestPath).toBe('work/voice/script-manifest.json');
    expect(track.transcription.words.map((entry) => entry.text)).toEqual(['abrimos', 'la', 'terminal']);
  });

  it('sin manifest de guion falla con voice-track-missing', async () => {
    const fileSystem = createFakeFileSystem([]);

    await expect(
      readVoiceScriptTrack(project, { readTextFile: fileSystem.readTextFile }),
    ).rejects.toMatchObject({ code: 'MONTAGE_INPUT_INVALID', reason: 'voice-track-missing' });
  });

  it('con un manifest que no es JSON falla con voice-track-unreadable', async () => {
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, voiceScriptManifestPath()), contents: 'no soy json' },
    ]);

    await expect(
      readVoiceScriptTrack(project, { readTextFile: fileSystem.readTextFile }),
    ).rejects.toMatchObject({ reason: 'voice-track-unreadable' });
  });

  it('con un manifest que no pasa el schema falla con voice-track-unreadable', async () => {
    const fileSystem = fileSystemWith({ ...MANIFEST, lines: [] }, WORDS);

    await expect(
      readVoiceScriptTrack(project, { readTextFile: fileSystem.readTextFile }),
    ).rejects.toMatchObject({ reason: 'voice-track-unreadable' });
  });

  it('sin el documento de palabras falla con voice-track-unreadable', async () => {
    const fileSystem = createFakeFileSystem([
      { path: toAbsolutePath(project, voiceScriptManifestPath()), contents: JSON.stringify(MANIFEST) },
    ]);

    await expect(
      readVoiceScriptTrack(project, { readTextFile: fileSystem.readTextFile }),
    ).rejects.toMatchObject({ reason: 'voice-track-unreadable' });
  });

  it('con palabras que no pasan el schema de Transcription falla con voice-track-unreadable', async () => {
    const fileSystem = fileSystemWith(MANIFEST, { ...WORDS, words: [{ text: 'sin tiempos' }] });

    await expect(
      readVoiceScriptTrack(project, { readTextFile: fileSystem.readTextFile }),
    ).rejects.toMatchObject({ reason: 'voice-track-unreadable' });
  });
});
