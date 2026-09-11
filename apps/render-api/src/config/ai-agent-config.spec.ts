import { describe, expect, it } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import {
  DEFAULT_AI_AGENT_BINARY,
  DEFAULT_AI_AGENT_MODEL,
  DEFAULT_AI_AGENT_TIMEOUT_MS,
  readAiAgentConfig,
} from './ai-agent-config';

const NEUTRAL_DIR = '/tmp/neutral';

describe('readAiAgentConfig', () => {
  it('usa los defaults y el directorio neutro con el entorno vacío', () => {
    expect(readAiAgentConfig({}, NEUTRAL_DIR)).toEqual({
      binaryPath: DEFAULT_AI_AGENT_BINARY,
      workingDirectory: NEUTRAL_DIR,
      timeoutMs: DEFAULT_AI_AGENT_TIMEOUT_MS,
      model: DEFAULT_AI_AGENT_MODEL,
    });
  });

  it('trata el string vacío como ausente en las cuatro variables', () => {
    const config = readAiAgentConfig(
      { CLAUDE_CLI_PATH: '', CLAUDE_CLI_CWD: '', CLAUDE_CLI_TIMEOUT_MS: '', CLAUDE_CLI_MODEL: '' },
      NEUTRAL_DIR,
    );

    expect(config).toEqual({
      binaryPath: DEFAULT_AI_AGENT_BINARY,
      workingDirectory: NEUTRAL_DIR,
      timeoutMs: DEFAULT_AI_AGENT_TIMEOUT_MS,
      model: DEFAULT_AI_AGENT_MODEL,
    });
  });

  it('nunca deja el modelo sin declarar', () => {
    expect(DEFAULT_AI_AGENT_MODEL).toBe('sonnet');
    expect(readAiAgentConfig({}, NEUTRAL_DIR).model).toBe('sonnet');
  });

  it('toma cada variable declarada', () => {
    const config = readAiAgentConfig(
      {
        CLAUDE_CLI_PATH: '/opt/homebrew/bin/claude',
        CLAUDE_CLI_CWD: '/var/empty',
        CLAUDE_CLI_TIMEOUT_MS: '120000',
        CLAUDE_CLI_MODEL: 'sonnet',
      },
      NEUTRAL_DIR,
    );

    expect(config).toEqual({
      binaryPath: '/opt/homebrew/bin/claude',
      workingDirectory: '/var/empty',
      timeoutMs: 120000,
      model: 'sonnet',
    });
  });

  it.each(['0', '-1', '1.5', 'abc'])('rechaza el timeout inválido %s', (raw) => {
    try {
      readAiAgentConfig({ CLAUDE_CLI_TIMEOUT_MS: raw }, NEUTRAL_DIR);
      expect.unreachable('readAiAgentConfig debe rechazar un timeout inválido');
    } catch (error) {
      expect(isRenderApiError(error)).toBe(true);
      expect(isRenderApiError(error) && error.code).toBe('SERVER_CONFIG_INVALID');
      expect(isRenderApiError(error) && error.resource).toBe('CLAUDE_CLI_TIMEOUT_MS');
    }
  });
});
