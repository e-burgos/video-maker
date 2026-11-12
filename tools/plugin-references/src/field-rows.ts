export type JsonSchemaNode = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode | JsonSchemaNode[];
  prefixItems?: JsonSchemaNode[];
  additionalProperties?: boolean | JsonSchemaNode;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  description?: string;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  $ref?: string;
  $defs?: Record<string, JsonSchemaNode>;
};

export type FieldRow = {
  path: string;
  types: string[];
  requiredEverywhere: boolean;
  values: string[];
  defaultValue: string;
  description: string;
  appliesTo: string[];
  unionSize: number;
};

type WalkContext = { root: JsonSchemaNode; rows: Map<string, FieldRow>; refStack: string[]; condition: string | undefined; unionSize: number };

const MAX_DEPTH_REFS = 3;

function resolveRef(ref: string, root: JsonSchemaNode): JsonSchemaNode | undefined {
  const name = ref.replace(/^#\/\$defs\//u, '');
  return root.$defs?.[name];
}

function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function constraintSuffix(node: JsonSchemaNode): string {
  const parts: string[] = [];
  if (node.minimum !== undefined && Math.abs(node.minimum) < Number.MAX_SAFE_INTEGER) parts.push(`min ${node.minimum}`);
  if (node.maximum !== undefined && Math.abs(node.maximum) < Number.MAX_SAFE_INTEGER) parts.push(`max ${node.maximum}`);
  if (node.minLength !== undefined && node.minLength > 1) parts.push(`minLength ${node.minLength}`);
  if (node.maxLength !== undefined) parts.push(`maxLength ${node.maxLength}`);
  if (node.minItems !== undefined && node.minItems > 0) parts.push(`minItems ${node.minItems}`);
  if (node.maxItems !== undefined) parts.push(`maxItems ${node.maxItems}`);
  if (node.pattern !== undefined && node.pattern.length <= 40) parts.push(`pattern ${node.pattern}`);
  return parts.length === 0 ? '' : ` (${parts.join(', ')})`;
}

function describeType(node: JsonSchemaNode, ctx: WalkContext): string {
  if (node.$ref !== undefined) {
    const target = resolveRef(node.$ref, ctx.root);
    return target === undefined ? 'unknown' : describeType(target, ctx);
  }
  const variants = node.anyOf ?? node.oneOf;
  if (variants !== undefined && variants.every((variant) => variant.const !== undefined)) return 'enum';
  if (variants !== undefined) {
    return [...new Set(variants.map((variant) => describeType(variant, ctx)))].join(' | ');
  }
  if (node.const !== undefined) return `const ${formatValue(node.const)}`;
  if (node.enum !== undefined) return 'enum';
  const base = Array.isArray(node.type) ? node.type.join(' | ') : (node.type ?? 'any');
  if (base === 'array') {
    const item = Array.isArray(node.items) ? undefined : node.items;
    return `${item === undefined ? 'any' : describeType(item, ctx)}[]${constraintSuffix(node)}`;
  }
  if (base === 'object' && node.properties === undefined && typeof node.additionalProperties === 'object') {
    return `record<string, ${describeType(node.additionalProperties, ctx)}>`;
  }
  return `${base}${constraintSuffix(node)}`;
}

function collectValues(node: JsonSchemaNode, ctx: WalkContext): string[] {
  if (node.$ref !== undefined) {
    const target = resolveRef(node.$ref, ctx.root);
    return target === undefined ? [] : collectValues(target, ctx);
  }
  const variants = node.anyOf ?? node.oneOf;
  if (variants !== undefined) return variants.flatMap((variant) => collectValues(variant, ctx));
  if (node.const !== undefined) return [formatValue(node.const)];
  if (node.enum !== undefined) return node.enum.map(formatValue);
  if (node.type === 'array' && node.items !== undefined && !Array.isArray(node.items)) return collectValues(node.items, ctx);
  return [];
}

function discriminatorOf(variant: JsonSchemaNode, ctx: WalkContext): string | undefined {
  const target = variant.$ref !== undefined ? resolveRef(variant.$ref, ctx.root) : variant;
  const entry = Object.entries(target?.properties ?? {}).find(([, property]) => property.const !== undefined || property.enum?.length === 1);
  if (entry === undefined) return undefined;
  const [key, property] = entry;
  return `${key}=${formatValue(property.const ?? property.enum?.[0])}`;
}

function recordRow(path: string, node: JsonSchemaNode, required: boolean, ctx: WalkContext): void {
  const resolved = node.$ref !== undefined ? (resolveRef(node.$ref, ctx.root) ?? node) : node;
  const type = describeType(node, ctx);
  const values = collectValues(node, ctx);
  const description = node.description ?? resolved.description ?? '';
  const defaultValue = node.default !== undefined ? formatValue(node.default) : resolved.default !== undefined ? formatValue(resolved.default) : '';
  const existing = ctx.rows.get(path);
  if (existing === undefined) {
    ctx.rows.set(path, {
      path,
      types: [type],
      requiredEverywhere: required,
      values: [...new Set(values)],
      defaultValue,
      description,
      appliesTo: ctx.condition === undefined ? [] : [ctx.condition],
      unionSize: ctx.unionSize,
    });
    return;
  }
  if (!existing.types.includes(type)) existing.types.push(type);
  existing.requiredEverywhere = existing.requiredEverywhere && required;
  existing.values = [...new Set([...existing.values, ...values])];
  if (existing.defaultValue === '') existing.defaultValue = defaultValue;
  if (existing.description === '') existing.description = description;
  if (ctx.condition !== undefined && !existing.appliesTo.includes(ctx.condition)) existing.appliesTo.push(ctx.condition);
}

function walk(node: JsonSchemaNode, path: string, ctx: WalkContext): void {
  if (node.$ref !== undefined) {
    const depth = ctx.refStack.filter((entry) => entry === node.$ref).length;
    const target = resolveRef(node.$ref, ctx.root);
    if (target === undefined || depth >= MAX_DEPTH_REFS) return;
    walk(target, path, { ...ctx, refStack: [...ctx.refStack, node.$ref] });
    return;
  }
  const variants = node.anyOf ?? node.oneOf;
  if (variants !== undefined) {
    variants.forEach((variant) => {
      const discriminator = discriminatorOf(variant, ctx);
      walk(variant, path, { ...ctx, condition: discriminator ?? ctx.condition, unionSize: discriminator === undefined ? ctx.unionSize : variants.length });
    });
    return;
  }
  node.allOf?.forEach((part) => walk(part, path, ctx));
  if (node.type === 'array' && node.items !== undefined && !Array.isArray(node.items)) {
    walk(node.items, `${path}[]`, ctx);
    return;
  }
  if (node.properties !== undefined) {
    const required = new Set(node.required ?? []);
    Object.entries(node.properties).forEach(([key, child]) => {
      const childPath = path === '' ? key : `${path}.${key}`;
      recordRow(childPath, child, required.has(key), ctx);
      walk(child, childPath, ctx);
    });
    return;
  }
  if (typeof node.additionalProperties === 'object' && path !== '') {
    walk(node.additionalProperties, `${path}.*`, ctx);
  }
}

export function flattenSchema(schema: JsonSchemaNode): FieldRow[] {
  const ctx: WalkContext = { root: schema, rows: new Map(), refStack: [], condition: undefined, unionSize: 0 };
  walk(schema, '', ctx);
  return [...ctx.rows.values()];
}

function cell(text: string): string {
  return text.replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ');
}

function codeList(values: string[]): string {
  return values.map((value) => `\`${cell(value)}\``).join(', ');
}

export function renderFieldTable(rows: FieldRow[]): string {
  const header = '| Field | Type | Required | Allowed values | Default | Applies to | Description |\n| --- | --- | --- | --- | --- | --- | --- |';
  const lines = rows.map((row) => {
    const required = row.requiredEverywhere ? 'yes' : 'no';
    const values = row.values.length === 0 ? '' : codeList(row.values);
    const defaultValue = row.defaultValue === '' ? '' : `\`${cell(row.defaultValue)}\``;
    const appliesTo = row.appliesTo.length === 0 || row.appliesTo.length >= row.unionSize ? '' : codeList(row.appliesTo);
    return `| \`${row.path}\` | ${cell(row.types.join(' / '))} | ${required} | ${values} | ${defaultValue} | ${appliesTo} | ${cell(row.description)} |`;
  });
  return [header, ...lines].join('\n');
}
