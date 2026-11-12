import { z } from 'zod';

import { createHttpRenderApiClient } from '../client/http-render-api-client';
import { createStudioApiClient } from '../client/studio-api-client';
import type { StudioApiClient } from '../client/studio-api-client';
import { STUDIO_TOOL_NAMES } from '../contract/tool-names';
import type { StudioToolName } from '../contract/tool-names';
import { STUDIO_TOOLS } from '../contract/tool-schemas';
import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import { createStudioToolHandlers } from '../handlers/studio-tool-handlers';
import type { StudioToolHandler } from '../handlers/studio-tool-handlers';
import { hasOutputSchema } from '../mcp/studio-mcp-server';
import type { McpToolRegistration } from '../mcp/studio-mcp-server';
import {
  EXTERNAL_EXCLUDED_TOOL_NAMES,
  EXTERNAL_ONLY_TOOLS,
  EXTERNAL_ONLY_TOOL_NAMES,
  NON_PROJECT_SCOPED_TOOL_NAMES,
  ProjectSlugSchema,
} from './external-tool-definitions';
import type { ExternalOnlyToolName } from './external-tool-definitions';
import type { StudioConnection } from './studio-connection';
import type { StudioEndpoint } from './studio-endpoint';

export interface ExternalRegistrationsOptions {
  readonly connection: StudioConnection;
  readonly model?: string;
  readonly fetchImpl?: typeof fetch;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function omitKeys(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));
}

function parseWith<T>(schema: z.ZodTypeAny, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new StudioToolRuntimeError('INVALID_INPUT', result.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`).join('; '));
  }
  return result.data as T;
}

function createExternalOnlyHandlers(
  studioFor: () => Promise<{ readonly client: StudioApiClient; readonly endpoint: StudioEndpoint }>,
): Readonly<Record<ExternalOnlyToolName, StudioToolHandler>> {
  const input = <T>(name: ExternalOnlyToolName, raw: unknown): T => parseWith<T>(EXTERNAL_ONLY_TOOLS[name].input, raw);

  return {
    studio_status: async (raw) => {
      input('studio_status', raw);
      const { client, endpoint } = await studioFor();
      const health = await client.getHealth();
      return {
        data: {
          apiUrl: endpoint.apiUrl,
          source: endpoint.source,
          version: typeof health.version === 'string' ? health.version : 'unknown',
          status: typeof health.status === 'string' ? health.status : 'unknown',
          capabilities: health.capabilities ?? null,
          engine: health.engine ?? null,
          binaries: health.binaries ?? null,
        },
      };
    },
    get_capabilities: async (raw) => {
      input('get_capabilities', raw);
      return { data: await (await studioFor()).client.getCapabilities() };
    },
    list_projects: async (raw) => {
      input('list_projects', raw);
      return { data: { projects: await (await studioFor()).client.listProjects() } };
    },
    create_project: async (raw) => {
      const body = input<Record<string, unknown>>('create_project', raw);
      return { data: asRecord(await (await studioFor()).client.createProject(body)) };
    },
    upload_asset: async (raw) => {
      const { slug, role, filePath, filename } = input<{ slug: string; role: string; filePath: string; filename?: string }>('upload_asset', raw);
      const uploaded = await (await studioFor()).client.uploadProjectAsset(slug, role, {
        filePath,
        ...(filename === undefined ? {} : { fileName: filename }),
      });
      return { data: asRecord(uploaded) };
    },
    list_brands: async (raw) => {
      input('list_brands', raw);
      const brands = await (await studioFor()).client.listBrands();
      return { data: Array.isArray(brands) ? { brands } : asRecord(brands) };
    },
    get_brand: async (raw) => {
      const { id } = input<{ id: string }>('get_brand', raw);
      return { data: asRecord(await (await studioFor()).client.getBrand(id)) };
    },
    create_brand: async (raw) => {
      const body = input<Record<string, unknown>>('create_brand', raw);
      return { data: asRecord(await (await studioFor()).client.createBrand(body)) };
    },
    update_brand: async (raw) => {
      const { id, manifest } = input<{ id: string; manifest: Record<string, unknown> }>('update_brand', raw);
      return { data: asRecord(await (await studioFor()).client.updateBrand(id, manifest)) };
    },
    upload_brand_file: async (raw) => {
      const { id, kind, filePath, name } = input<{ id: string; kind: string; filePath: string; name?: string }>('upload_brand_file', raw);
      const uploaded = await (await studioFor()).client.uploadBrandFile(id, kind, {
        filePath,
        ...(name === undefined ? {} : { fileName: name }),
      });
      return { data: asRecord(uploaded) };
    },
  };
}

export function createExternalToolRegistrations(options: ExternalRegistrationsOptions): readonly McpToolRegistration[] {
  const { connection } = options;
  const projectHandlersBySlug = new Map<string, Readonly<Record<StudioToolName, StudioToolHandler>>>();

  async function studioFor() {
    const endpoint = await connection.endpoint();
    return {
      endpoint,
      client: createStudioApiClient({
        apiUrl: endpoint.apiUrl,
        ...(endpoint.accessToken === undefined ? {} : { accessToken: endpoint.accessToken }),
        ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
      }),
    };
  }

  async function projectHandlersFor(slug: string): Promise<Readonly<Record<StudioToolName, StudioToolHandler>>> {
    const endpoint = await connection.endpoint();
    const key = `${endpoint.apiUrl}\u0000${endpoint.accessToken ?? ''}\u0000${slug}`;
    const cached = projectHandlersBySlug.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const handlers = createStudioToolHandlers({
      client: createHttpRenderApiClient({
        apiUrl: endpoint.apiUrl,
        slug,
        ...(endpoint.accessToken === undefined ? {} : { accessToken: endpoint.accessToken }),
        ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
      }),
      ...(options.model === undefined ? {} : { model: options.model }),
    });
    projectHandlersBySlug.set(key, handlers);
    return handlers;
  }

  function guarded(handler: StudioToolHandler): StudioToolHandler {
    return async (raw) => {
      try {
        return await handler(raw);
      } catch (cause) {
        if (cause instanceof StudioToolRuntimeError && cause.code === 'STUDIO_UNAVAILABLE') {
          connection.invalidate();
          projectHandlersBySlug.clear();
        }
        throw cause;
      }
    };
  }

  const externalOnlyHandlers = createExternalOnlyHandlers(studioFor);

  const externalOnly: McpToolRegistration[] = EXTERNAL_ONLY_TOOL_NAMES.map((name) => ({
    name,
    description: EXTERNAL_ONLY_TOOLS[name].description,
    input: EXTERNAL_ONLY_TOOLS[name].input,
    output: EXTERNAL_ONLY_TOOLS[name].output,
    handler: guarded(externalOnlyHandlers[name]),
  }));

  const reusedNames = STUDIO_TOOL_NAMES.filter((name) => !EXTERNAL_EXCLUDED_TOOL_NAMES.includes(name));
  const reused: McpToolRegistration[] = reusedNames.map((name) => {
    const definition = STUDIO_TOOLS[name];
    const baseInput = definition.input as z.ZodObject;
    const output = hasOutputSchema(name) ? definition.output : undefined;

    if (NON_PROJECT_SCOPED_TOOL_NAMES.includes(name)) {
      return {
        name,
        description: definition.description,
        input: baseInput,
        output,
        handler: guarded(async (raw) => (await projectHandlersFor('studio'))[name](raw)),
      };
    }

    return {
      name,
      description: `${definition.description} Pass \`slug\`: the project this applies to.`,
      input: z.object({ slug: ProjectSlugSchema, ...baseInput.shape }),
      output,
      handler: guarded(async (raw) => {
        const slug = parseWith<string>(ProjectSlugSchema, asRecord(raw)['slug']);
        return (await projectHandlersFor(slug))[name](omitKeys(asRecord(raw), ['slug']));
      }),
    };
  });

  return [...externalOnly, ...reused];
}
