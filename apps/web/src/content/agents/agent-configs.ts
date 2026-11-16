export const MCP_PACKAGE = '@e-burgos/video-maker-mcp';

export const MCP_NPX_COMMAND = `npx -y ${MCP_PACKAGE}`;

export const CLAUDE_CODE_INSTALL = ['/plugin marketplace add e-burgos/video-maker', '/plugin install video-maker@video-maker'].join('\n');

export const COPILOT_MCP_JSON = JSON.stringify(
  { servers: { 'video-maker': { type: 'stdio', command: 'npx', args: ['-y', MCP_PACKAGE] } } },
  null,
  2,
);

export const GEMINI_SETTINGS_JSON = JSON.stringify(
  { mcpServers: { 'video-maker': { command: 'npx', args: ['-y', MCP_PACKAGE] } } },
  null,
  2,
);

export const STUDIO_URL_ENV = 'VIDEO_MAKER_API_URL=http://127.0.0.1:4399';
