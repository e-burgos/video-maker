import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createHttpRenderApiClient } from '../client/http-render-api-client';
import { createExternalToolRegistrations } from '../external/external-tool-registrations';
import { createStudioConnection } from '../external/studio-connection';
import { createStudioToolHandlers } from '../handlers/studio-tool-handlers';
import { STUDIO_MCP_USAGE, isHelpRequest, parseStudioMcpCliArgs } from './studio-mcp-cli-args';
import { STUDIO_API_TOKEN_ENV_VAR } from './studio-mcp-launch';
import { createMcpServerFromRegistrations, createStudioMcpServer } from './studio-mcp-server';

export async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (isHelpRequest(argv)) {
    process.stdout.write(`${STUDIO_MCP_USAGE}\n`);
    return;
  }

  const args = parseStudioMcpCliArgs(argv);

  if (args.project === null || args.apiUrl === null) {
    const connection = createStudioConnection({ apiUrlArgument: args.apiUrl, env: process.env });
    const registrations = createExternalToolRegistrations({
      connection,
      ...(args.model === null ? {} : { model: args.model }),
    });
    await createMcpServerFromRegistrations(registrations).connect(new StdioServerTransport());
    return;
  }

  const accessToken = process.env[STUDIO_API_TOKEN_ENV_VAR];
  const client = createHttpRenderApiClient({
    apiUrl: args.apiUrl,
    slug: args.project,
    ...(accessToken === undefined || accessToken === '' ? {} : { accessToken }),
  });
  const handlers = createStudioToolHandlers({ client, ...(args.model === null ? {} : { model: args.model }) });
  await createStudioMcpServer(handlers).connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
