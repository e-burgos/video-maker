import type { JsonSchemaNode } from './field-rows';

const EXTERNAL_REF = /^([a-z0-9-]+)\.schema\.json$/u;
const LOCAL_DEF_REF = /^#\/\$defs\/(.+)$/u;

type Externals = Record<string, JsonSchemaNode>;

const renameDef = (schemaId: string, name: string): string => `${schemaId}__${name}`;

function rewriteLocalRefs(node: unknown, schemaId: string): unknown {
  if (Array.isArray(node)) return node.map((entry) => rewriteLocalRefs(entry, schemaId));
  if (typeof node !== 'object' || node === null) return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => {
      const localDef = key === '$ref' && typeof value === 'string' ? LOCAL_DEF_REF.exec(value) : null;
      return localDef === null || localDef[1] === undefined
        ? [key, rewriteLocalRefs(value, schemaId)]
        : [key, `#/$defs/${renameDef(schemaId, localDef[1])}`];
    }),
  );
}

function bodyOf(schema: JsonSchemaNode, schemaId: string): { body: JsonSchemaNode; defs: Record<string, JsonSchemaNode> } {
  const { $defs, ...rest } = rewriteLocalRefs(schema, schemaId) as JsonSchemaNode & Record<string, unknown>;
  delete rest.$schema;
  delete rest.$id;
  return { body: rest, defs: $defs ?? {} };
}

export function inlineExternalRefs(root: JsonSchemaNode, externals: Externals): JsonSchemaNode {
  const collectedDefs: Record<string, JsonSchemaNode> = {};
  const expanded = new Set<string>();

  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (typeof node !== 'object' || node === null) return node;
    const ref = (node as { $ref?: unknown }).$ref;
    const match = typeof ref === 'string' ? EXTERNAL_REF.exec(ref) : null;
    const schemaId = match?.[1];
    const external = schemaId === undefined ? undefined : externals[schemaId];
    if (schemaId !== undefined && external !== undefined) {
      const { body, defs } = bodyOf(external, schemaId);
      if (!expanded.has(schemaId)) {
        expanded.add(schemaId);
        Object.entries(defs).forEach(([name, def]) => {
          collectedDefs[renameDef(schemaId, name)] = visit(def) as JsonSchemaNode;
        });
      }
      return visit(body);
    }
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, visit(value)]));
  };

  const result = visit(root) as JsonSchemaNode;
  return { ...result, $defs: { ...(result.$defs ?? {}), ...collectedDefs } };
}
