import { describe, expect, it } from 'vitest';

import { healthyVoiceService } from './__fixtures__/voice';
import { canGenerateVoice, voiceBlockers, voiceFailureKey } from './voice-capability';
import { MESSAGES_EN } from '../i18n/messages-en';

describe('voiceBlockers', () => {
  it('is empty when the queue is exposed and the six binaries resolve', () => {
    expect(voiceBlockers(healthyVoiceService())).toEqual([]);
    expect(canGenerateVoice(healthyVoiceService())).toBe(true);
  });

  it('blocks while the health document has not been read', () => {
    expect(voiceBlockers(null)).toEqual([{ key: 'voice.blocker.healthUnknown' }]);
    expect(MESSAGES_EN['voice.blocker.healthUnknown']).toBe(
      'The render service health is unknown, so no voice-over can be generated.',
    );
    expect(canGenerateVoice(null)).toBe(false);
  });

  it('blocks when the service exposes no voice queue', () => {
    const health = healthyVoiceService();
    const blocked = {
      ...health,
      capabilities: { ...health.capabilities, voiceQueue: false },
    };
    expect(voiceBlockers(blocked)).toEqual([{ key: 'voice.blocker.noQueue' }]);
    expect(MESSAGES_EN['voice.blocker.noQueue']).toBe(
      'The render service does not expose a voice queue.',
    );
  });

  it('names the voice engine binary and its env var when it is missing, never a resolved path', () => {
    const health = healthyVoiceService();
    const blocked = {
      ...health,
      status: 'degraded' as const,
      binaries: health.binaries.map((binary) =>
        binary.name === 'ttsCli' ? { ...binary, resolved: false } : binary,
      ),
    };
    expect(voiceBlockers(blocked)).toEqual([
      {
        key: 'voice.blocker.binaryUnresolved',
        params: { name: 'ttsCli', envVar: 'TTS_CLI_PATH' },
      },
    ]);
    expect(canGenerateVoice(blocked)).toBe(false);
  });

  it('blocks on the voices directory too: the engine without a voice cannot synthesize', () => {
    const health = healthyVoiceService();
    const blocked = {
      ...health,
      binaries: health.binaries.map((binary) =>
        binary.name === 'ttsVoicesDir' ? { ...binary, resolved: false } : binary,
      ),
    };
    expect(voiceBlockers(blocked)).toEqual([
      {
        key: 'voice.blocker.binaryUnresolved',
        params: { name: 'ttsVoicesDir', envVar: 'TTS_VOICES_DIR' },
      },
    ]);
  });

  it('blocks on whisper as well, because every track is aligned word by word', () => {
    const health = healthyVoiceService();
    const blocked = {
      ...health,
      binaries: health.binaries.map((binary) =>
        binary.name === 'whisperCli' ? { ...binary, resolved: false } : binary,
      ),
    };
    expect(voiceBlockers(blocked)).toEqual([
      {
        key: 'voice.blocker.binaryUnresolved',
        params: { name: 'whisperCli', envVar: 'WHISPER_CPP_PATH' },
      },
    ]);
    expect(MESSAGES_EN['voice.blocker.binaryUnresolved']).toBe('{name} is not resolved ({envVar}).');
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

describe('voiceFailureKey', () => {
  it('explains the typed codes of the voice pipeline in the words of a user', () => {
    expect(MESSAGES_EN['voiceFailure.VOICE_MODEL_UNAVAILABLE']).toContain('TTS_VOICES_DIR');
    expect(MESSAGES_EN['voiceFailure.VOICE_TRANSCRIPTION_FAILED']).toContain('manifest');
    expect(MESSAGES_EN['voiceFailure.STORYBOARD_NOT_FOUND']).toContain('storyboard');
  });

  it('returns null for a code it does not know, so the raw code still reaches the screen', () => {
    expect(voiceFailureKey('SOMETHING_ELSE')).toBeNull();
  });
});
