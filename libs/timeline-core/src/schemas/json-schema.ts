import { z } from 'zod';

import { SCHEMA_FILE_NAMES, timelineSchemaRegistry } from './registry';
import type { SchemaFileName } from './registry';

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';
const JSON_SCHEMA_BASE_URI = 'https://video-maker.local/schemas';
const SHARED_DOC_ID = '__shared';
const SHARED_REF_PREFIX = `${SHARED_DOC_ID}.schema.json#/$defs/`;

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sharedDefName(value: JsonValue): string | undefined {
  if (!isJsonObject(value)) {
    return undefined;
  }
  const ref = value.$ref;
  return typeof ref === 'string' && ref.startsWith(SHARED_REF_PREFIX)
    ? ref.slice(SHARED_REF_PREFIX.length)
    : undefined;
}

function localizeSharedRefs(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(localizeSharedRefs);
  }
  if (!isJsonObject(value)) {
    return value;
  }
  const defName = sharedDefName(value);
  if (defName !== undefined) {
    return { $ref: `#/$defs/${defName}` };
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, localizeSharedRefs(entry)]));
}

function collectSharedDefNames(value: JsonValue | undefined, names: Set<string>): void {
  if (value === undefined) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectSharedDefNames(entry, names));
    return;
  }
  if (!isJsonObject(value)) {
    return;
  }
  const defName = sharedDefName(value);
  if (defName !== undefined) {
    names.add(defName);
  }
  Object.values(value).forEach((entry) => collectSharedDefNames(entry, names));
}

function closureOfSharedDefs(startNames: ReadonlySet<string>, sharedDefs: JsonObject): Set<string> {
  const closure = new Set(startNames);
  const pending = [...startNames];

  while (pending.length > 0) {
    const name = pending.pop();
    if (name === undefined) {
      continue;
    }
    const nested = new Set<string>();
    collectSharedDefNames(sharedDefs[name], nested);
    nested.forEach((nestedName) => {
      if (!closure.has(nestedName)) {
        closure.add(nestedName);
        pending.push(nestedName);
      }
    });
  }

  return closure;
}

function inlineSharedDefs(document: JsonObject, sharedDefs: JsonObject): JsonObject {
  const usedNames = new Set<string>();
  collectSharedDefNames(document, usedNames);

  if (usedNames.size === 0) {
    return document;
  }

  const closure = closureOfSharedDefs(usedNames, sharedDefs);
  const localDefs: JsonObject = {};
  closure.forEach((name) => {
    const def = sharedDefs[name];
    if (def !== undefined) {
      localDefs[name] = localizeSharedRefs(def);
    }
  });

  const { $defs: existingDefs, ...rest } = document;
  return {
    ...(localizeSharedRefs(rest) as JsonObject),
    $defs: {
      ...(isJsonObject(existingDefs) ? (localizeSharedRefs(existingDefs) as JsonObject) : {}),
      ...localDefs,
    },
  };
}

function withStableEnvelope(id: SchemaFileName, document: JsonObject): JsonObject {
  const rest = { ...document };
  delete rest.$schema;
  delete rest.$id;
  delete rest.id;

  return {
    $schema: JSON_SCHEMA_DIALECT,
    $id: `${JSON_SCHEMA_BASE_URI}/${id}.schema.json`,
    ...rest,
  };
}

export function buildJsonSchemaBundle(): Record<SchemaFileName, JsonObject> {
  const { schemas: rawSchemas } = z.toJSONSchema(timelineSchemaRegistry, {
    uri: (schemaId) => `${schemaId}.schema.json`,
    unrepresentable: 'throw',
  }) as unknown as { schemas: Record<string, JsonObject | undefined> };

  const sharedDocument = rawSchemas[SHARED_DOC_ID];
  const sharedDefs = isJsonObject(sharedDocument?.$defs) ? sharedDocument.$defs : {};

  const entries = SCHEMA_FILE_NAMES.map((id) => {
    const document = rawSchemas[id];
    if (document === undefined) {
      throw new Error(`El registry no generó un JSON Schema para "${id}".`);
    }
    return [id, withStableEnvelope(id, inlineSharedDefs(document, sharedDefs))] as const;
  });

  return Object.fromEntries(entries) as Record<SchemaFileName, JsonObject>;
}

export function timelineToJsonSchema(): JsonObject {
  return buildJsonSchemaBundle().timeline;
}

export function serializeJsonSchemaFile(schema: JsonObject): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}
