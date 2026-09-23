import { describe, expect, it } from 'vitest';

import { parseStudioMcpCliArgs } from './studio-mcp-cli-args';

describe('parseStudioMcpCliArgs', () => {
  it('parses the three required flags', () => {
    expect(
      parseStudioMcpCliArgs(['--api-url', 'http://127.0.0.1:4599', '--project', 'pitch-deck', '--model', 'sonnet']),
    ).toEqual({ apiUrl: 'http://127.0.0.1:4599', project: 'pitch-deck', model: 'sonnet' });
  });

  it('reads the flags in any order', () => {
    expect(
      parseStudioMcpCliArgs(['--model', 'sonnet', '--project', 'pitch-deck', '--api-url', 'http://127.0.0.1:4599']),
    ).toEqual({ apiUrl: 'http://127.0.0.1:4599', project: 'pitch-deck', model: 'sonnet' });
  });

  it.each([
    ['--project', 'pitch-deck', '--model', 'sonnet'],
    ['--api-url', 'http://127.0.0.1:4599', '--model', 'sonnet'],
    ['--api-url', 'http://127.0.0.1:4599', '--project', 'pitch-deck'],
    [],
  ])('throws when a required flag is missing (%s)', (...argv) => {
    expect(() => parseStudioMcpCliArgs(argv)).toThrow(/usage:/);
  });
});
