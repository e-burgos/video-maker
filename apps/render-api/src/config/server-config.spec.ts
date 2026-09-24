import { describe, expect, it } from 'vitest';

import { isRenderApiError } from '../errors/render-api-error';
import {
  ACCESS_TOKEN_ENV_VAR,
  DEFAULT_HOST,
  DEFAULT_PORT,
  HOST_ENV_VAR,
  PORT_ENV_VAR,
  readServerConfig,
  WEB_ROOT_ENV_VAR,
} from './server-config';

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

  it('webRoot and accessToken default to null (US-017-202, US-017-205)', () => {
    const config = readServerConfig({});
    expect(config.webRoot).toBeNull();
    expect(config.accessToken).toBeNull();
  });

  it('reads webRoot and accessToken when set, empty string treated as unset', () => {
    expect(readServerConfig({ [WEB_ROOT_ENV_VAR]: '/app/resources/web' }).webRoot).toBe(
      '/app/resources/web',
    );
    expect(readServerConfig({ [ACCESS_TOKEN_ENV_VAR]: 'abc123' }).accessToken).toBe('abc123');
    expect(readServerConfig({ [WEB_ROOT_ENV_VAR]: '', [ACCESS_TOKEN_ENV_VAR]: '' })).toMatchObject({
      webRoot: null,
      accessToken: null,
    });
  });
});
