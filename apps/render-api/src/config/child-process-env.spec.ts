import { describe, expect, it } from 'vitest';

import { allowlistedChildEnv } from './child-process-env';

describe('allowlistedChildEnv', () => {
  it('keeps the base identity, locale and PATH variables only', () => {
    const source: NodeJS.ProcessEnv = {
      HOME: '/Users/dev',
      USER: 'dev',
      LOGNAME: 'dev',
      TMPDIR: '/tmp',
      PATH: '/usr/bin:/bin',
      SHELL: '/bin/zsh',
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      SECRET_TOKEN: 'do-not-leak',
      RENDER_API_ACCESS_TOKEN: 'do-not-leak-either',
    };

    expect(allowlistedChildEnv(source)).toEqual({
      HOME: '/Users/dev',
      USER: 'dev',
      LOGNAME: 'dev',
      TMPDIR: '/tmp',
      PATH: '/usr/bin:/bin',
      SHELL: '/bin/zsh',
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
    });
  });

  it('passes CLAUDE_CODE_* and ANTHROPIC_* through only when already present, for the CLI subscription auth', () => {
    const withThem = allowlistedChildEnv({
      CLAUDE_CODE_OAUTH_TOKEN: 'present',
      ANTHROPIC_API_KEY: 'present-too',
    });
    expect(withThem).toEqual({
      CLAUDE_CODE_OAUTH_TOKEN: 'present',
      ANTHROPIC_API_KEY: 'present-too',
    });

    expect(allowlistedChildEnv({})).toEqual({});
  });

  it('never leaks an unrelated variable, no matter how it is named', () => {
    expect(allowlistedChildEnv({ NPM_TOKEN: 'leak', AWS_SECRET_ACCESS_KEY: 'leak' })).toEqual({});
  });
});
