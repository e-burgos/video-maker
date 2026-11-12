import { flattenSchema, renderFieldTable } from './field-rows';
import { REFERENCE_SOURCES } from './reference-sources';

export const REGENERATE_COMMAND = 'pnpm nx run plugin-references:plugin-references';
export const REFERENCES_DIR = 'plugins/video-maker/skills/video-maker/references';

export type GeneratedFile = { relativePath: string; contents: string };

const serialize = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export function buildSchemaReferences(): GeneratedFile[] {
  return REFERENCE_SOURCES.flatMap((source) => {
    const schema = source.jsonSchema();
    const markdown = [
      `# ${source.title} reference`,
      '',
      `Generated from ${source.sourcePath} — do not edit by hand; run \`${REGENERATE_COMMAND}\`.`,
      '',
      `Machine-readable schema: \`schemas/${source.schemaFile}\`.`,
      '',
      renderFieldTable(flattenSchema(source.flatSchema())),
      '',
    ].join('\n');
    return [
      { relativePath: `${REFERENCES_DIR}/${source.id}.md`, contents: markdown },
      { relativePath: `${REFERENCES_DIR}/schemas/${source.schemaFile}`, contents: serialize(schema) },
    ];
  });
}

export function collectKnownFieldPaths(): Set<string> {
  const paths = new Set<string>();
  REFERENCE_SOURCES.forEach((source) => {
    flattenSchema(source.flatSchema()).forEach((row) => paths.add(row.path));
  });
  return paths;
}
