import { describe, expect, it } from 'vitest';

import { isHelpRequest, parseStudioMcpCliArgs } from './studio-mcp-cli-args';

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
    ['--model', 'sonnet', '--project', 'pitch-deck'],
    ['--api-url', 'http://127.0.0.1:4599', '--project', 'pitch-deck'],
  ])('throws when --project lacks its companions (%s)', (...argv) => {
    expect(() => parseStudioMcpCliArgs(argv)).toThrow(/usage:/);
  });

  it('runs in external mode without any flag', () => {
    expect(parseStudioMcpCliArgs([])).toEqual({ apiUrl: null, project: null, model: null });
  });

  it('keeps an explicit api url and model in external mode', () => {
    expect(parseStudioMcpCliArgs(['--api-url', 'http://127.0.0.1:4599', '--model', 'sonnet'])).toEqual({
      apiUrl: 'http://127.0.0.1:4599',
      project: null,
      model: 'sonnet',
    });
  });

  it('recognises a help request', () => {
    expect(isHelpRequest(['--help'])).toBe(true);
    expect(isHelpRequest(['--api-url', 'x'])).toBe(false);
  });
});
