import { describe, expect, it } from 'vitest';

import { BinaryNotFoundError } from './binary-not-found-error';
import { CommandFailedError, STDERR_MAX_BYTES, truncateStderr } from './command-failed-error';
import { isMediaLocalError, MediaLocalError } from './media-local-error';
import { MissingMediaStreamError } from './missing-media-stream-error';
import { SAMPLE_MAX_CHARS, UnparseableOutputError } from './unparseable-output-error';
import { UnresolvedAudioAssetError } from './unresolved-audio-asset-error';

describe('truncateStderr', () => {
  it('no trunca un texto de exactamente 2048 bytes (límite inclusivo)', () => {
    const stderr = 'a'.repeat(STDERR_MAX_BYTES);

    const { text, truncated } = truncateStderr(stderr);

    expect(Buffer.byteLength(text, 'utf8')).toBe(STDERR_MAX_BYTES);
    expect(truncated).toBe(false);
    expect(text).toBe(stderr);
  });

  it('trunca conservando el sufijo cuando excede el límite en un solo byte', () => {
    const stderr = 'b'.repeat(STDERR_MAX_BYTES + 1);

    const { text, truncated } = truncateStderr(stderr);

    expect(Buffer.byteLength(text, 'utf8')).toBe(STDERR_MAX_BYTES);
    expect(truncated).toBe(true);
    expect(stderr.endsWith(text)).toBe(true);
  });

  it('no deja un carácter de reemplazo cuando el corte parte un carácter multibyte', () => {
    const stderr = `ñ${'a'.repeat(2047)}`;

    const { text, truncated } = truncateStderr(stderr);

    expect(truncated).toBe(true);
    expect(Buffer.byteLength(text, 'utf8')).toBe(2047);
    expect(text.startsWith('�')).toBe(false);
    expect(stderr.endsWith(text)).toBe(true);
  });

  it('un stderr vacío no se trunca', () => {
    expect(truncateStderr('')).toEqual({ text: '', truncated: false });
  });
});

describe('isMediaLocalError', () => {
  it('reconoce cualquier miembro de la jerarquía y descarta lo demás', () => {
    expect(isMediaLocalError(new CommandFailedError({ command: 'ffmpeg', args: [], exitCode: 1, stderr: '' }))).toBe(
      true,
    );
    expect(
      isMediaLocalError(new UnresolvedAudioAssetError({ assetId: 'voice-1', clipId: 'voice-0', track: 'voice' })),
    ).toBe(true);
    expect(isMediaLocalError(new Error('no'))).toBe(false);
    expect(isMediaLocalError('no')).toBe(false);
    expect(isMediaLocalError(undefined)).toBe(false);
  });
});

describe('BinaryNotFoundError', () => {
  it('expone binary, envVar y searchedPaths', () => {
    const error = new BinaryNotFoundError({
      binary: 'ffprobe',
      envVar: 'FFPROBE_PATH',
      searchedPaths: ['/usr/bin/ffprobe'],
    });

    expect(error.code).toBe('BINARY_NOT_FOUND');
    expect(error.binary).toBe('ffprobe');
    expect(error.envVar).toBe('FFPROBE_PATH');
    expect(error.searchedPaths).toEqual(['/usr/bin/ffprobe']);
    expect(error).toBeInstanceOf(MediaLocalError);
  });

  it('searchedPaths y envVar quedan vacío/indefinido por default', () => {
    const error = new BinaryNotFoundError({ binary: 'whisper-cli' });

    expect(error.searchedPaths).toEqual([]);
    expect(error.envVar).toBeUndefined();
  });
});

describe('UnparseableOutputError', () => {
  it('recorta sample a SAMPLE_MAX_CHARS caracteres', () => {
    const error = new UnparseableOutputError({
      command: 'ffprobe',
      reason: 'JSON inválido',
      sample: 'x'.repeat(SAMPLE_MAX_CHARS + 100),
    });

    expect(error.sample).toHaveLength(SAMPLE_MAX_CHARS);
    expect(error.code).toBe('UNPARSEABLE_OUTPUT');
  });

  it('conserva la causa original cuando se provee', () => {
    const cause = new SyntaxError('bad json');

    const error = new UnparseableOutputError({ command: 'ffprobe', reason: 'r', sample: 's', cause });

    expect(error.cause).toBe(cause);
  });
});

describe('UnresolvedAudioAssetError', () => {
  it('expone assetId, clipId y track, e incluye el assetId en el mensaje (CA-005)', () => {
    const error = new UnresolvedAudioAssetError({ assetId: 'music-1', clipId: 'music-0', track: 'music' });

    expect(error.code).toBe('UNRESOLVED_AUDIO_ASSET');
    expect(error.assetId).toBe('music-1');
    expect(error.clipId).toBe('music-0');
    expect(error.track).toBe('music');
    expect(error.message).toContain('music-1');
    expect(error).toBeInstanceOf(MediaLocalError);
  });

  it('distingue la pista voice de la pista music', () => {
    const error = new UnresolvedAudioAssetError({ assetId: 'voice-1', clipId: 'voice-0', track: 'voice' });

    expect(error.track).toBe('voice');
  });
});

describe('MissingMediaStreamError', () => {
  it('expone path, stream y assetId, con mensaje distinto para stream audio', () => {
    const error = new MissingMediaStreamError({ path: '/tmp/voice.wav', stream: 'audio', assetId: 'aroll-1' });

    expect(error.code).toBe('MISSING_MEDIA_STREAM');
    expect(error.path).toBe('/tmp/voice.wav');
    expect(error.stream).toBe('audio');
    expect(error.assetId).toBe('aroll-1');
    expect(error.message).toBe(
      'El archivo "/tmp/voice.wav" no tiene stream de audio: no se puede medir ni mezclar.',
    );
    expect(error).toBeInstanceOf(MediaLocalError);
  });

  it('usa el mensaje de stream de video y deja assetId indefinido por default', () => {
    const error = new MissingMediaStreamError({ path: '/tmp/input.mp4', stream: 'video' });

    expect(error.message).toBe(
      'El archivo "/tmp/input.mp4" no tiene stream de video: no se puede muxear con -c:v copy.',
    );
    expect(error.assetId).toBeUndefined();
  });

  it('isMediaLocalError lo reconoce', () => {
    expect(isMediaLocalError(new MissingMediaStreamError({ path: '/tmp/x.mp4', stream: 'video' }))).toBe(true);
  });
});
