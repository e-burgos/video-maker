import { join } from 'node:path';

export interface StudioMcpLaunchInput {
  readonly repoRoot: string;
  readonly apiUrl: string;
  readonly project: string;
  readonly model: string;
  readonly nodeExecutable?: string;
}

export interface StudioMcpLaunchCommand {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly cwd: string;
}

export function buildStudioMcpLaunchCommand(input: StudioMcpLaunchInput): StudioMcpLaunchCommand {
  return {
    command: input.nodeExecutable ?? process.execPath,
    args: [
      '-r',
      join(input.repoRoot, 'libs/producer-tools/src/mcp/mcp-register.cjs'),
      join(input.repoRoot, 'libs/producer-tools/src/mcp/main.ts'),
      '--api-url',
      input.apiUrl,
      '--project',
      input.project,
      '--model',
      input.model,
    ],
    env: { SWC_NODE_PROJECT: join(input.repoRoot, 'tsconfig.base.json') },
    cwd: input.repoRoot,
  };
}
