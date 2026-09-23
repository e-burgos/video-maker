import { buildStudioMcpLaunchCommand } from '@video-maker/producer-tools';

export interface ProducerMcpConfigInput {
  readonly repoRoot: string;
  readonly apiUrl: string;
  readonly project: string;
  readonly model: string;
}

export function buildProducerMcpConfigJson(input: ProducerMcpConfigInput): string {
  const launch = buildStudioMcpLaunchCommand(input);
  return JSON.stringify({
    mcpServers: {
      studio: {
        command: launch.command,
        args: launch.args,
        env: launch.env,
      },
    },
  });
}
