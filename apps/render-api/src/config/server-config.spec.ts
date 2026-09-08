import { describe, expect, it } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import { DEFAULT_HOST, DEFAULT_PORT, HOST_ENV_VAR, PORT_ENV_VAR, readServerConfig } from './server-config';

function expectInvalidPort(port: string): void {
  try {
    readServerConfig({ [PORT_ENV_VAR]: port });
    throw new Error(`expected RENDER_API_PORT=${port} to be rejected`);
  } catch (error) {
    if (!isRenderApiError(error)) {
      throw error;
    }
    expect(error.code).toBe('SERVER_CONFIG_INVALID');
  }
}

describe('readServerConfig', () => {
  it('defaults the host to 127.0.0.1 when RENDER_API_HOST is unset', () => {
    expect(readServerConfig({}).host).toBe(DEFAULT_HOST);
    expect(readServerConfig({ [HOST_ENV_VAR]: '0.0.0.0' }).host).toBe('0.0.0.0');
  });

  it('defaults the port to 4310 when RENDER_API_PORT is unset or empty', () => {
    expect(readServerConfig({}).port).toBe(DEFAULT_PORT);
    expect(readServerConfig({ [PORT_ENV_VAR]: '' }).port).toBe(DEFAULT_PORT);
  });

  it('throws SERVER_CONFIG_INVALID for a non-integer or out-of-range RENDER_API_PORT', () => {
    for (const invalidPort of ['not-a-number', '3.5', '65536', '-1']) {
      expectInvalidPort(invalidPort);
    }

    expect(readServerConfig({ [PORT_ENV_VAR]: '0' }).port).toBe(0);
    expect(readServerConfig({ [PORT_ENV_VAR]: '65535' }).port).toBe(65535);
  });
});
