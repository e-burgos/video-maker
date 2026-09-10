import { describe, expect, it } from 'vitest';

import { healthyVoiceService } from './__fixtures__/voice';
import { canGenerateVoice, voiceBlockers, voiceFailureExplanation } from './voice-capability';

describe('voiceBlockers', () => {
  it('is empty when the queue is exposed and the six binaries resolve', () => {
    expect(voiceBlockers(healthyVoiceService())).toEqual([]);
    expect(canGenerateVoice(healthyVoiceService())).toBe(true);
  });

  it('blocks while the health document has not been read', () => {
    expect(voiceBlockers(null)).toEqual([
      'The render service health is unknown, so no voice-over can be generated.',
    ]);
    expect(canGenerateVoice(null)).toBe(false);
  });

  it('blocks when the service exposes no voice queue', () => {
    const health = healthyVoiceService();
    const blocked = {
      ...health,
      capabilities: { ...health.capabilities, voiceQueue: false },
    };
    expect(voiceBlockers(blocked)).toEqual(['The render service does not expose a voice queue.']);
  });

  it('names the Piper binary and its env var when it is missing, never a resolved path', () => {
    const health = healthyVoiceService();
    const blocked = {
      ...health,
      status: 'degraded' as const,
      binaries: health.binaries.map((binary) =>
        binary.name === 'piperCli' ? { ...binary, resolved: false } : binary,
      ),
    };
    expect(voiceBlockers(blocked)).toEqual(['piperCli is not resolved (PIPER_PATH).']);
    expect(canGenerateVoice(blocked)).toBe(false);
  });

  it('blocks on the voice model too: a Piper without a voice cannot synthesize', () => {
    const health = healthyVoiceService();
    const blocked = {
      ...health,
      binaries: health.binaries.map((binary) =>
        binary.name === 'piperModel' ? { ...binary, resolved: false } : binary,
      ),
    };
    expect(voiceBlockers(blocked)).toEqual(['piperModel is not resolved (PIPER_MODEL_PATH).']);
  });

  it('blocks on whisper as well, because every track is aligned word by word', () => {
    const health = healthyVoiceService();
    const blocked = {
      ...health,
      binaries: health.binaries.map((binary) =>
        binary.name === 'whisperCli' ? { ...binary, resolved: false } : binary,
      ),
    };
    expect(voiceBlockers(blocked)).toEqual(['whisperCli is not resolved (WHISPER_CPP_PATH).']);
  });

  it('ignores a binary this pipeline does not use', () => {
    const health = healthyVoiceService();
    const blocked = {
      ...health,
      binaries: [...health.binaries, { name: 'claude', envVar: 'CLAUDE_CLI_PATH', resolved: false }],
    };
    expect(voiceBlockers(blocked)).toEqual([]);
  });
});

describe('voiceFailureExplanation', () => {
  it('explains the typed codes of the voice pipeline in the words of a user', () => {
    expect(voiceFailureExplanation('VOICE_MODEL_UNAVAILABLE')).toContain('PIPER_MODEL_PATH');
    expect(voiceFailureExplanation('VOICE_TRANSCRIPTION_FAILED')).toContain('manifest');
    expect(voiceFailureExplanation('STORYBOARD_NOT_FOUND')).toContain('storyboard');
  });

  it('returns null for a code it does not know, so the raw code still reaches the screen', () => {
    expect(voiceFailureExplanation('SOMETHING_ELSE')).toBeNull();
  });
});
