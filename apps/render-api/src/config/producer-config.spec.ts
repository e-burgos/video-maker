import { describe, expect, it } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import {
  DEFAULT_PRODUCER_MODEL,
  DEFAULT_PRODUCER_MODELS,
  describeProducerModel,
  DEFAULT_PRODUCER_TURN_TIMEOUT_MS,
  readProducerConfig,
} from './producer-config';

const REPO_ROOT = '/repo';
const FALLBACK_URL = 'http://127.0.0.1:4310';

describe('readProducerConfig', () => {
  it('usa sonnet por costo y media hora de timeout por default', () => {
    expect(readProducerConfig({}, REPO_ROOT, FALLBACK_URL)).toEqual({
      binaryPath: 'claude',
      workingDirectory: REPO_ROOT,
      model: DEFAULT_PRODUCER_MODEL,
      models: [...DEFAULT_PRODUCER_MODELS],
      timeoutMs: DEFAULT_PRODUCER_TURN_TIMEOUT_MS,
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

  it('deja elegir modelo, timeout y URL de la API', () => {
    expect(
      readProducerConfig(
        {
          PRODUCER_MODEL: 'opus',
          PRODUCER_TURN_TIMEOUT_MS: '600000',
          RENDER_API_URL: 'http://127.0.0.1:4399',
        },
        REPO_ROOT,
        FALLBACK_URL,
      ),
    ).toEqual({
      binaryPath: 'claude',
      workingDirectory: REPO_ROOT,
      model: 'opus',
      models: [...DEFAULT_PRODUCER_MODELS],
      timeoutMs: 600_000,
      apiUrl: 'http://127.0.0.1:4399',
    });
  });

  it('trata la variable vacía como ausente', () => {
    expect(readProducerConfig({ PRODUCER_MODEL: '' }, REPO_ROOT, FALLBACK_URL).model).toBe('sonnet');
  });

  it('deja declarar la lista de modelos que el usuario puede elegir, sin repetidos ni espacios', () => {
    expect(
      readProducerConfig(
        { PRODUCER_MODELS: ' haiku , sonnet ,haiku ', PRODUCER_MODEL: 'haiku' },
        REPO_ROOT,
        FALLBACK_URL,
      ).models,
    ).toEqual(['haiku', 'sonnet']);
  });

  it('rechaza un PRODUCER_MODEL que no pertenece a PRODUCER_MODELS: el default tiene que ser elegible', () => {
    try {
      readProducerConfig({ PRODUCER_MODELS: 'haiku,sonnet', PRODUCER_MODEL: 'opus' }, REPO_ROOT, FALLBACK_URL);
      expect.unreachable('debía rechazar un default fuera de la lista');
    } catch (error) {
      expect(isRenderApiError(error) ? error.code : null).toBe('SERVER_CONFIG_INVALID');
      expect(isRenderApiError(error) ? error.resource : null).toBe('PRODUCER_MODEL');
    }
  });

  it('rechaza una lista de modelos que no nombra ninguno', () => {
    try {
      readProducerConfig({ PRODUCER_MODELS: ' , ' }, REPO_ROOT, FALLBACK_URL);
      expect.unreachable('debía rechazar una lista vacía');
    } catch (error) {
      expect(isRenderApiError(error) ? error.code : null).toBe('SERVER_CONFIG_INVALID');
    }
  });

  it('describe cada modelo con label y descripción para la UI, y cae al id cuando no lo conoce', () => {
    expect(describeProducerModel('sonnet')).toEqual({
      id: 'sonnet',
      label: 'Sonnet',
      description: 'Balanced · faster, cheaper',
    });
    expect(describeProducerModel('opus').description).toBe('Most capable · slower, costlier');
    expect(describeProducerModel('haiku').description).toBe('Fastest · lightest');
    expect(describeProducerModel('claude-3-5-haiku-20241022').label).toBe('claude-3-5-haiku-20241022');
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
