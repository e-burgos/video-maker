import { describe, expect, it } from 'vitest';

import { STUDIO_MCP_SERVER_NAME, STUDIO_TOOL_NAMES, claudeCodeToolName, isStudioToolName } from './tool-names';

describe('STUDIO_TOOL_NAMES', () => {
  it('has 32 unique tool names', () => {
    expect(STUDIO_TOOL_NAMES.length).toBe(32);
    expect(new Set(STUDIO_TOOL_NAMES).size).toBe(STUDIO_TOOL_NAMES.length);
  });
});

describe('isStudioToolName', () => {
  it.each(STUDIO_TOOL_NAMES)('accepts %s', (name) => {
    expect(isStudioToolName(name)).toBe(true);
  });

  it('rejects an unknown name', () => {
    expect(isStudioToolName('delete_project')).toBe(false);
  });

  it('rejects a non-string', () => {
    expect(isStudioToolName(42)).toBe(false);
  });
});

describe('claudeCodeToolName', () => {
  it('prefixes the tool name with the mcp server namespace', () => {
    expect(claudeCodeToolName('probe_media')).toBe(`mcp__${STUDIO_MCP_SERVER_NAME}__probe_media`);
  });
});
