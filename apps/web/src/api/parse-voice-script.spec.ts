import { describe, expect, it } from 'vitest';

import { VOICE_SCRIPT_MANIFEST_JSON } from './__fixtures__/voice';
import { parseVoiceScriptManifest } from './parse-voice-script';

describe('parseVoiceScriptManifest (FIX-009-003)', () => {
  it('devuelve el manifest cuando el documento valida', () => {
    const manifest = parseVoiceScriptManifest(VOICE_SCRIPT_MANIFEST_JSON);

    expect(manifest?.voiceId).toBe('es_AR-daniela-high');
    expect(manifest?.lines).toHaveLength(2);
  });

  it('devuelve null cuando el archivo no es JSON', () => {
    expect(parseVoiceScriptManifest('not json at all')).toBeNull();
  });

  it('devuelve null cuando el JSON no es un manifest de guion', () => {
    expect(parseVoiceScriptManifest('{"schemaVersion":1}')).toBeNull();
  });

  it('devuelve null cuando el manifest viene sin líneas', () => {
    const withoutLines = JSON.stringify({
      ...(JSON.parse(VOICE_SCRIPT_MANIFEST_JSON) as Record<string, unknown>),
      lines: [],
    });

    expect(parseVoiceScriptManifest(withoutLines)).toBeNull();
  });
});
