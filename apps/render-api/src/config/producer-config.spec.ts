import { describe, expect, it } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import {
  DEFAULT_PRODUCER_MODEL,
  DEFAULT_PRODUCER_SKILL_PATH,
  DEFAULT_PRODUCER_TURN_TIMEOUT_MS,
  readProducerConfig,
} from './producer-config';

const REPO_ROOT = '/repo';
const FALLBACK_URL = 'http://127.0.0.1:4310';

describe('readProducerConfig', () => {
  it('usa sonnet por costo, media hora de timeout y la skill del repo por default', () => {
    expect(readProducerConfig({}, REPO_ROOT, FALLBACK_URL)).toEqual({
      binaryPath: 'claude',
      workingDirectory: REPO_ROOT,
      model: DEFAULT_PRODUCER_MODEL,
      timeoutMs: DEFAULT_PRODUCER_TURN_TIMEOUT_MS,
      skillPath: DEFAULT_PRODUCER_SKILL_PATH,
      apiUrl: FALLBACK_URL,
    });
    expect(DEFAULT_PRODUCER_MODEL).toBe('sonnet');
    expect(DEFAULT_PRODUCER_TURN_TIMEOUT_MS).toBe(1_800_000);
  });

  it('reusa CLAUDE_CLI_PATH de spec-008 en vez de una variable propia del productor', () => {
    expect(
      readProducerConfig({ CLAUDE_CLI_PATH: '/opt/homebrew/bin/claude' }, REPO_ROOT, FALLBACK_URL)
        .binaryPath,
    ).toBe('/opt/homebrew/bin/claude');
  });

  it('deja elegir modelo, timeout, skill y URL de la API', () => {
    expect(
      readProducerConfig(
        {
          PRODUCER_MODEL: 'opus',
          PRODUCER_TURN_TIMEOUT_MS: '600000',
          PRODUCER_SKILL_PATH: '/tmp/SKILL.md',
          RENDER_API_URL: 'http://127.0.0.1:4399',
        },
        REPO_ROOT,
        FALLBACK_URL,
      ),
    ).toEqual({
      binaryPath: 'claude',
      workingDirectory: REPO_ROOT,
      model: 'opus',
      timeoutMs: 600_000,
      skillPath: '/tmp/SKILL.md',
      apiUrl: 'http://127.0.0.1:4399',
    });
  });

  it('trata la variable vacía como ausente', () => {
    expect(readProducerConfig({ PRODUCER_MODEL: '' }, REPO_ROOT, FALLBACK_URL).model).toBe('sonnet');
  });

  it('aborta con SERVER_CONFIG_INVALID en vez de caer al default cuando el timeout no sirve', () => {
    for (const raw of ['0', '-1', 'medio minuto', '1.5']) {
      try {
        readProducerConfig({ PRODUCER_TURN_TIMEOUT_MS: raw }, REPO_ROOT, FALLBACK_URL);
        expect.unreachable(`debía rechazar ${raw}`);
      } catch (error) {
        expect(isRenderApiError(error) ? error.code : null).toBe('SERVER_CONFIG_INVALID');
      }
    }
  });
});
