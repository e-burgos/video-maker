type JsonObject = Record<string, unknown>;

const KEYWORDS_THE_AGENT_CLI_REJECTS: ReadonlySet<string> = new Set(['format', 'default']);
const KEYWORDS_HOLDING_NAMED_SCHEMAS: ReadonlySet<string> = new Set(['properties', '$defs', 'definitions']);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function itemsSchemaFor(prefixItems: readonly unknown[]): unknown {
  const distinct = [...new Map(prefixItems.map((item) => [JSON.stringify(item), item])).values()];
  return distinct.length === 1 ? distinct[0] : { anyOf: distinct };
}

function sanitizeNamedSchemas(named: unknown): unknown {
  if (!isObject(named)) {
    return named;
  }

  return Object.fromEntries(Object.entries(named).map(([name, schema]) => [name, sanitizeSchema(schema)]));
}

function sanitizeSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(sanitizeSchema);
  }

  if (!isObject(schema)) {
    return schema;
  }

  const sanitized: JsonObject = {};

  for (const [keyword, value] of Object.entries(schema)) {
    if (KEYWORDS_THE_AGENT_CLI_REJECTS.has(keyword)) {
      continue;
    }

    sanitized[keyword] = KEYWORDS_HOLDING_NAMED_SCHEMAS.has(keyword) ? sanitizeNamedSchemas(value) : sanitizeSchema(value);
  }

  if (Array.isArray(sanitized.prefixItems)) {
    const { prefixItems, ...rest } = sanitized;
    return { ...rest, items: itemsSchemaFor(prefixItems as readonly unknown[]) };
  }

  return sanitized;
}

export function toAgentJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  return sanitizeSchema(schema) as Record<string, unknown>;
}
