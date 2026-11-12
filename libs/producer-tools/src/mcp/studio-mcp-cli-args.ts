export interface StudioMcpCliArgs {
  readonly apiUrl: string | null;
  readonly project: string | null;
  readonly model: string | null;
}

export const STUDIO_MCP_USAGE =
  'usage: video-maker-mcp [--api-url <url>] [--project <slug> --model <alias>]\n' +
  '  external mode (no --project): finds the studio through VIDEO_MAKER_API_URL or ~/.video-maker/studio.*.json; every project tool takes a slug argument\n' +
  '  project mode (--project): bound to one project, as the studio producer launches it (requires --api-url and --model)';

function readFlag(argv: readonly string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  return index === -1 ? null : (argv[index + 1] ?? null);
}

export function isHelpRequest(argv: readonly string[]): boolean {
  return argv.includes('--help') || argv.includes('-h');
}

export function parseStudioMcpCliArgs(argv: readonly string[]): StudioMcpCliArgs {
  const apiUrl = readFlag(argv, '--api-url');
  const project = readFlag(argv, '--project');
  const model = readFlag(argv, '--model');

  if (project !== null && (apiUrl === null || model === null)) {
    throw new Error(`--project needs --api-url and --model\n${STUDIO_MCP_USAGE}`);
  }

  return { apiUrl, project, model };
}
