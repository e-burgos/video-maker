import { readFileSync } from 'node:fs';

export function readFixture(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
