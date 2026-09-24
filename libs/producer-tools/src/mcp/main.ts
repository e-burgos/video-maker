import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createHttpRenderApiClient } from '../client/http-render-api-client';
import { createStudioToolHandlers } from '../handlers/studio-tool-handlers';
import { parseStudioMcpCliArgs } from './studio-mcp-cli-args';
import { STUDIO_API_TOKEN_ENV_VAR } from './studio-mcp-launch';
import { createStudioMcpServer } from './studio-mcp-server';

export async function main(): Promise<void> {
  const args = parseStudioMcpCliArgs(process.argv.slice(2));
  const accessToken = process.env[STUDIO_API_TOKEN_ENV_VAR];
  const client = createHttpRenderApiClient({
    apiUrl: args.apiUrl,
    slug: args.project,
    ...(accessToken === undefined || accessToken === '' ? {} : { accessToken }),
  });
  const handlers = createStudioToolHandlers({ client, model: args.model });
  const server = createStudioMcpServer(handlers);
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
