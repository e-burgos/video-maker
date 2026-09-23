# producer-tools

The studio tools of the conversational producer, defined once and served over MCP.

- `contract/` — the frozen contract: 14 tool names (`STUDIO_TOOL_NAMES`), Zod input and output
  schemas (`STUDIO_TOOLS`), and the closed list of error codes (`STUDIO_TOOL_ERROR_CODES`). Frozen in
  `sdd/specs/spec-e-burgos-017-desktop-app/cycles/cycle-01/plan.md` § Contrato MCP.
- `client/` — the `RenderApiClient` port and its HTTP implementation, bound to one project.
- `handlers/` — `createStudioToolHandlers({ client, model })`: validates input and output, injects the
  turn model into `voice` and `storyboard` jobs, polls jobs for `wait_for_job`.
- `mcp/` — `createStudioMcpServer`, the stdio entry `main.ts` (`--api-url --project --model`) and
  `buildStudioMcpLaunchCommand`, which `apps/render-api` turns into the inline `--mcp-config` of a turn.
- `prompt/` — `buildProducerPrompt`, the producer system prompt written against the tools.

Two constraints found against the real CLI and SDK:

- `extract_frames` declares no `outputSchema` and returns only `content`: Claude Code 2.1.123 forwards
  `structuredContent` to the model instead of the content blocks, so images would never arrive.
- `start_job` takes a discriminated union, which the MCP SDK publishes as an empty object schema; its
  description carries a literal example per `kind`, and the handler still validates strictly.

Run the server by hand: `pnpm nx run producer-tools:mcp -- --api-url http://127.0.0.1:4310 --project <slug> --model sonnet`.
