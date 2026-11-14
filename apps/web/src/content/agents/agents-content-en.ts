import type { AgentsContent } from './agents-content';
import {
  CLAUDE_CODE_INSTALL,
  COPILOT_MCP_JSON,
  GEMINI_SETTINGS_JSON,
  MCP_NPX_COMMAND,
  STUDIO_URL_ENV,
} from './agent-configs';

export const AGENTS_EN: AgentsContent = {
  title: 'Connect your agents',
  lede: 'Let your coding agent produce videos with this studio: it reads your project, sets up the brand and the material and drives the studio over MCP. Publishing and deleting are always yours, from here.',
  studioNote: 'The studio has to be open while the agent works: the desktop app or pnpm studio.',
  sections: {
    'claude-code': {
      title: 'Claude Code',
      lede: 'The plugin brings the video production skills and the MCP server already configured.',
      steps: [
        'Open Claude Code in the project you want the video about.',
        'Add the marketplace and install the plugin with these two commands.',
        'Restart Claude Code if it asks, then ask for a video in plain words, for example "make a tutorial of the checkout".',
      ],
      blocks: [{ id: 'install', label: 'Commands in Claude Code', code: CLAUDE_CODE_INSTALL }],
    },
    copilot: {
      title: 'GitHub Copilot (VS Code)',
      lede: 'Copilot uses the MCP server directly, no plugin.',
      steps: [
        'Create the .vscode folder at the project root if it does not exist.',
        'Save this content in .vscode/mcp.json (if it already has servers, add only the video-maker entry).',
        'In the Copilot chat pick Agent mode and enable the video-maker tools.',
      ],
      blocks: [{ id: 'mcp-json', label: '.vscode/mcp.json', code: COPILOT_MCP_JSON }],
    },
    gemini: {
      title: 'Gemini CLI',
      lede: 'Gemini CLI reads MCP servers from its settings file.',
      steps: [
        'Open ~/.gemini/settings.json (or .gemini/settings.json inside the project).',
        'Add the video-maker entry inside mcpServers, keeping the ones you already have.',
        'Restart Gemini CLI and run /mcp to confirm video-maker shows as connected.',
      ],
      blocks: [{ id: 'settings-json', label: 'settings.json', code: GEMINI_SETTINGS_JSON }],
    },
    other: {
      title: 'Another MCP client',
      lede: 'Any client that speaks MCP over stdio can connect with the same command.',
      steps: [
        'Register a stdio server with this command. It needs Node.js 22 or newer.',
        'The server finds the studio open on this machine by itself. To force one, set the environment variable below.',
      ],
      blocks: [
        { id: 'command', label: 'Command', code: MCP_NPX_COMMAND },
        { id: 'env', label: 'Optional variable to force the studio', code: STUDIO_URL_ENV },
      ],
    },
  },
};
