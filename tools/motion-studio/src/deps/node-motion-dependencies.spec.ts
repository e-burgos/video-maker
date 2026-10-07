import { describe, expect, it } from 'vitest';

import { subscriptionOnlyEnv } from './node-motion-dependencies';

describe('subscriptionOnlyEnv', () => {
  it('drops the API key so the Claude CLI signs in with the subscription and keeps everything else', () => {
    expect(subscriptionOnlyEnv({ ANTHROPIC_API_KEY: 'sk-from-dotenv', HOME: '/home/u', CLAUDE_CODE_OAUTH_TOKEN: 'oauth' })).toEqual({ HOME: '/home/u', CLAUDE_CODE_OAUTH_TOKEN: 'oauth' });
  });
});
