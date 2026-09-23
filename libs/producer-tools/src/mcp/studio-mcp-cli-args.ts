export interface StudioMcpCliArgs {
  readonly apiUrl: string;
  readonly project: string;
  readonly model: string;
}

function readFlag(argv: readonly string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  return index === -1 ? null : (argv[index + 1] ?? null);
}

export function parseStudioMcpCliArgs(argv: readonly string[]): StudioMcpCliArgs {
  const apiUrl = readFlag(argv, '--api-url');
  const project = readFlag(argv, '--project');
  const model = readFlag(argv, '--model');

  if (apiUrl === null || project === null || model === null) {
    throw new Error('usage: studio-mcp-server --api-url <url> --project <slug> --model <alias>');
  }

  return { apiUrl, project, model };
}
