import { join } from 'node:path';

export const STUDIO_API_TOKEN_ENV_VAR = 'STUDIO_API_TOKEN';

export interface StudioMcpLaunchInput {
  readonly repoRoot: string;
  readonly apiUrl: string;
  readonly project: string;
  readonly model: string;
  readonly nodeExecutable?: string;
  readonly accessToken?: string;
  readonly compiledEntryPath?: string;
}

export interface StudioMcpLaunchCommand {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly cwd: string;
}

function tokenEnv(accessToken: string | undefined): Readonly<Record<string, string>> {
  return accessToken === undefined ? {} : { [STUDIO_API_TOKEN_ENV_VAR]: accessToken };
}

export function buildStudioMcpLaunchCommand(input: StudioMcpLaunchInput): StudioMcpLaunchCommand {
  const command = input.nodeExecutable ?? process.execPath;
  const cliArgs = ['--api-url', input.apiUrl, '--project', input.project, '--model', input.model];

  if (input.compiledEntryPath !== undefined) {
    return {
      command,
      args: [input.compiledEntryPath, ...cliArgs],
      env: { ...tokenEnv(input.accessToken), ELECTRON_RUN_AS_NODE: '1' },
      cwd: input.repoRoot,
    };
  }

  return {
    command,
    args: [
      '-r',
      join(input.repoRoot, 'libs/producer-tools/src/mcp/mcp-register.cjs'),
      join(input.repoRoot, 'libs/producer-tools/src/mcp/main.ts'),
      ...cliArgs,
    ],
    env: { ...tokenEnv(input.accessToken), SWC_NODE_PROJECT: join(input.repoRoot, 'tsconfig.base.json') },
    cwd: input.repoRoot,
  };
}
