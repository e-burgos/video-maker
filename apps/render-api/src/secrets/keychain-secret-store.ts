import { spawn } from 'node:child_process';

import { PipelineStageError } from '../errors/pipeline-stage-error';

export const KEYCHAIN_SERVICE_ENV_VAR = 'RENDER_API_KEYCHAIN_SERVICE';
export const DEFAULT_KEYCHAIN_SERVICE = 'Video Maker';

const SECURITY_BINARY_PATH = '/usr/bin/security';
const KEYCHAIN_ITEM_NOT_FOUND_EXIT_CODE = 44;

export interface SecretStore {
  readonly get: (name: string) => Promise<string | null>;
  readonly set: (name: string, value: string) => Promise<void>;
  readonly delete: (name: string) => Promise<void>;
}

export interface SecretStoreCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export type SecretStoreCommandRunner = (
  bin: string,
  args: readonly string[],
  stdin?: string,
) => Promise<SecretStoreCommandResult>;

export interface KeychainSecretStoreConfig {
  readonly service: string;
  readonly runner: SecretStoreCommandRunner;
}

export function readKeychainServiceName(env: NodeJS.ProcessEnv): string {
  const raw = env[KEYCHAIN_SERVICE_ENV_VAR];
  return raw === undefined || raw === '' ? DEFAULT_KEYCHAIN_SERVICE : raw;
}

export function createNodeSecretStoreCommandRunner(): SecretStoreCommandRunner {
  return (bin, args, stdin) =>
    new Promise((resolve, reject) => {
      const child = spawn(bin, [...args], { detached: true });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
      child.on('error', reject);
      child.on('close', (exitCode) => {
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          exitCode: exitCode ?? -1,
        });
      });

      if (stdin !== undefined) {
        child.stdin.write(stdin);
      }
      child.stdin.end();
    });
}

function secretStoreUnavailable(resource: string, cause?: unknown): PipelineStageError {
  return new PipelineStageError({
    code: 'SECRET_STORE_UNAVAILABLE',
    stage: null,
    resource,
    ...(cause === undefined ? {} : { cause }),
  });
}

export function createKeychainSecretStore(config: KeychainSecretStoreConfig): SecretStore {
  const { service, runner } = config;

  async function get(name: string): Promise<string | null> {
    const result = await runner(SECURITY_BINARY_PATH, [
      'find-generic-password',
      '-s',
      service,
      '-a',
      name,
      '-w',
    ]);

    if (result.exitCode === KEYCHAIN_ITEM_NOT_FOUND_EXIT_CODE) {
      return null;
    }
    if (result.exitCode !== 0) {
      throw secretStoreUnavailable(name);
    }
    return result.stdout.replace(/\r?\n$/, '');
  }

  async function set(name: string, value: string): Promise<void> {
    // -w with no trailing value keeps the secret out of argv (visible to `ps`); security then
    // prompts twice on stdin for its own write confirmation, so the value is written twice.
    const result = await runner(
      SECURITY_BINARY_PATH,
      ['add-generic-password', '-U', '-s', service, '-a', name, '-w'],
      `${value}\n${value}\n`,
    );

    if (result.exitCode !== 0) {
      throw secretStoreUnavailable(name);
    }

    // security exits 0 even when the two stdin prompts mismatched, silently storing an empty
    // password in that case, so the write is confirmed by reading the value back.
    const stored = await get(name);
    if (stored !== value) {
      throw secretStoreUnavailable(name);
    }
  }

  async function remove(name: string): Promise<void> {
    const result = await runner(SECURITY_BINARY_PATH, ['delete-generic-password', '-s', service, '-a', name]);

    if (result.exitCode !== 0 && result.exitCode !== KEYCHAIN_ITEM_NOT_FOUND_EXIT_CODE) {
      throw secretStoreUnavailable(name);
    }
  }

  return { get, set, delete: remove };
}
