import { describe, expect, it } from 'vitest';

import { toErrorPayload } from '../errors/to-error-payload';
import { createKeychainSecretStore } from './keychain-secret-store';
import type { SecretStoreCommandResult, SecretStoreCommandRunner } from './keychain-secret-store';

interface RecordedCall {
  readonly bin: string;
  readonly args: readonly string[];
  readonly stdin?: string;
}

type ResponseFactory = (call: RecordedCall) => SecretStoreCommandResult;

function createFakeRunner(respond: ResponseFactory): { runner: SecretStoreCommandRunner; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const runner: SecretStoreCommandRunner = async (bin, args, stdin) => {
    const call: RecordedCall = stdin === undefined ? { bin, args } : { bin, args, stdin };
    calls.push(call);
    return respond(call);
  };
  return { runner, calls };
}

function ok(stdout = ''): SecretStoreCommandResult {
  return { stdout, stderr: '', exitCode: 0 };
}

function notFound(): SecretStoreCommandResult {
  return { stdout: '', stderr: 'not found', exitCode: 44 };
}

function failure(): SecretStoreCommandResult {
  return { stdout: '', stderr: 'boom', exitCode: 1 };
}

async function caughtCode(promise: Promise<unknown>): Promise<string> {
  return promise.then(
    () => {
      throw new Error('expected the store to reject');
    },
    (error: unknown) => toErrorPayload(error).code,
  );
}

describe('createKeychainSecretStore get', () => {
  it('returns null when the item is not in the keychain', async () => {
    const { runner } = createFakeRunner(() => notFound());
    const store = createKeychainSecretStore({ service: 'Video Maker Test', runner });

    await expect(store.get('openrouter')).resolves.toBeNull();
  });

  it('returns the stored value with the trailing newline stripped', async () => {
    const { runner, calls } = createFakeRunner(() => ok('sk-or-v1-test-0000\n'));
    const store = createKeychainSecretStore({ service: 'Video Maker Test', runner });

    await expect(store.get('openrouter')).resolves.toBe('sk-or-v1-test-0000');
    expect(calls[0]).toEqual({
      bin: '/usr/bin/security',
      args: ['find-generic-password', '-s', 'Video Maker Test', '-a', 'openrouter', '-w'],
    });
  });

  it('never puts the secret in the command argv', async () => {
    const { runner, calls } = createFakeRunner(() => ok('sk-or-v1-test-0000'));
    const store = createKeychainSecretStore({ service: 'Video Maker Test', runner });

    await store.get('openrouter');

    for (const call of calls) {
      expect(call.args.join(' ')).not.toContain('sk-or-v1-test-0000');
    }
  });

  it('rejects with SECRET_STORE_UNAVAILABLE on an unexpected exit code', async () => {
    const { runner } = createFakeRunner(() => failure());
    const store = createKeychainSecretStore({ service: 'Video Maker Test', runner });

    await expect(caughtCode(store.get('openrouter'))).resolves.toBe('SECRET_STORE_UNAVAILABLE');
  });
});

describe('createKeychainSecretStore set', () => {
  it('writes the value via stdin twice and never in argv', async () => {
    const { runner, calls } = createFakeRunner((call) => {
      if (call.args[0] === 'add-generic-password') {
        return ok();
      }
      return ok('sk-or-v1-test-0000');
    });
    const store = createKeychainSecretStore({ service: 'Video Maker Test', runner });

    await store.set('openrouter', 'sk-or-v1-test-0000');

    const addCall = calls.find((call) => call.args[0] === 'add-generic-password');
    expect(addCall?.args).toEqual([
      'add-generic-password',
      '-U',
      '-s',
      'Video Maker Test',
      '-a',
      'openrouter',
      '-w',
    ]);
    expect(addCall?.stdin).toBe('sk-or-v1-test-0000\nsk-or-v1-test-0000\n');
    for (const call of calls) {
      expect(call.args.join(' ')).not.toContain('sk-or-v1-test-0000');
    }
  });

  it('rejects with SECRET_STORE_UNAVAILABLE when the write-back read does not match', async () => {
    const { runner } = createFakeRunner((call) => {
      if (call.args[0] === 'add-generic-password') {
        return ok();
      }
      return ok('something-else');
    });
    const store = createKeychainSecretStore({ service: 'Video Maker Test', runner });

    await expect(caughtCode(store.set('openrouter', 'sk-or-v1-test-0000'))).resolves.toBe(
      'SECRET_STORE_UNAVAILABLE',
    );
  });

  it('rejects with SECRET_STORE_UNAVAILABLE on a non-zero exit code', async () => {
    const { runner } = createFakeRunner(() => failure());
    const store = createKeychainSecretStore({ service: 'Video Maker Test', runner });

    await expect(caughtCode(store.set('openrouter', 'sk-or-v1-test-0000'))).resolves.toBe(
      'SECRET_STORE_UNAVAILABLE',
    );
  });
});

describe('createKeychainSecretStore delete', () => {
  it('treats a missing item as a successful delete', async () => {
    const { runner, calls } = createFakeRunner(() => notFound());
    const store = createKeychainSecretStore({ service: 'Video Maker Test', runner });

    await expect(store.delete('openrouter')).resolves.toBeUndefined();
    expect(calls[0]?.args).toEqual(['delete-generic-password', '-s', 'Video Maker Test', '-a', 'openrouter']);
  });

  it('deletes an existing item', async () => {
    const { runner } = createFakeRunner(() => ok());
    const store = createKeychainSecretStore({ service: 'Video Maker Test', runner });

    await expect(store.delete('openrouter')).resolves.toBeUndefined();
  });

  it('rejects with SECRET_STORE_UNAVAILABLE on an unexpected exit code', async () => {
    const { runner } = createFakeRunner(() => failure());
    const store = createKeychainSecretStore({ service: 'Video Maker Test', runner });

    await expect(caughtCode(store.delete('openrouter'))).resolves.toBe('SECRET_STORE_UNAVAILABLE');
  });
});
