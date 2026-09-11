import { describe, expect, it } from 'vitest';

import {
  DEFAULT_VOICE_SCRIPT_GAP_MS,
  VOICE_SCRIPT_MANIFEST_SCHEMA_VERSION,
  VoiceScriptManifestSchema,
  splitVoiceScriptLines,
} from '../schemas/voice-script-manifest.schema';

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: VOICE_SCRIPT_MANIFEST_SCHEMA_VERSION,
    source: 'script',
    language: 'es-AR',
    voiceId: 'es_AR-daniela-high',
    gapMs: DEFAULT_VOICE_SCRIPT_GAP_MS,
    path: 'work/voice/voice.wav',
    wordsPath: 'work/voice/voice.words.json',
    durationMs: 4200,
    sampleRate: 48000,
    updatedAt: '2026-09-11T10:00:00.000Z',
    lines: [
      { index: 1, text: 'Primera frase.', path: 'work/voice/lines/line-01.wav', startMs: 0, durationMs: 1500 },
      { index: 2, text: 'Segunda frase.', path: 'work/voice/lines/line-02.wav', startMs: 2400, durationMs: 1800 },
    ],
    ...overrides,
  };
}

describe('VoiceScriptManifestSchema', () => {
  it('accepts a manifest with its lines numbered from 1 and in order', () => {
    expect(VoiceScriptManifestSchema.safeParse(manifest()).success).toBe(true);
  });

  it('rejects lines out of order or not starting at 1', () => {
    const outOfOrder = manifest({
      lines: [
        { index: 2, text: 'Segunda.', path: 'work/voice/lines/line-02.wav', startMs: 0, durationMs: 10 },
        { index: 1, text: 'Primera.', path: 'work/voice/lines/line-01.wav', startMs: 20, durationMs: 10 },
      ],
    });

    expect(VoiceScriptManifestSchema.safeParse(outOfOrder).success).toBe(false);
  });

  it('rejects an empty script and any source other than script', () => {
    expect(VoiceScriptManifestSchema.safeParse(manifest({ lines: [] })).success).toBe(false);
    expect(VoiceScriptManifestSchema.safeParse(manifest({ source: 'storyboard' })).success).toBe(false);
  });

  it('rejects an unknown key', () => {
    expect(VoiceScriptManifestSchema.safeParse(manifest({ storyboardId: 'sb' })).success).toBe(false);
  });
});

describe('splitVoiceScriptLines', () => {
  it('keeps one sentence per line, collapsing inner whitespace and dropping blank lines', () => {
    expect(splitVoiceScriptLines('  Hola   mundo.  \n\n\tSegunda    linea.\n   \n')).toEqual([
      'Hola mundo.',
      'Segunda linea.',
    ]);
  });

  it('answers an empty list for a blank script', () => {
    expect(splitVoiceScriptLines('   \n\n')).toEqual([]);
  });

  it('defaults the gap to 900 ms', () => {
    expect(DEFAULT_VOICE_SCRIPT_GAP_MS).toBe(900);
  });
});
