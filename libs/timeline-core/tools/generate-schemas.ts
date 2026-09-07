import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { buildJsonSchemaBundle, serializeJsonSchemaFile } from '../src/schemas/json-schema';

const SCHEMAS_DIR = join(__dirname, '..', 'schemas');

function writeSchemaFile(id: string, contents: string): void {
  const filePath = join(SCHEMAS_DIR, `${id}.schema.json`);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, 'utf8');
}

function main(): void {
  const bundle = buildJsonSchemaBundle();

  Object.entries(bundle).forEach(([id, schema]) => {
    writeSchemaFile(id, serializeJsonSchemaFile(schema));
  });

  console.log(`Generados ${Object.keys(bundle).length} JSON Schema en ${SCHEMAS_DIR}`);
}

main();
