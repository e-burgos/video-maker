import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSchemaReferences, collectKnownFieldPaths, REGENERATE_COMMAND } from './build-references';
import { buildAllReferences } from './generate';
import { findUnknownFieldTokens } from './skill-field-check';

const WORKSPACE_ROOT = join(__dirname, '..', '..', '..');
const SKILLS_DIR = join(WORKSPACE_ROOT, 'plugins', 'video-maker', 'skills');
const KNOWN_TERMS_FILE = join(SKILLS_DIR, 'known-terms.txt');

function listSkillFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSkillFiles(path);
    return entry === 'SKILL.md' ? [path] : [];
  });
}

function readKnownTerms(): Set<string> {
  if (!existsSync(KNOWN_TERMS_FILE)) return new Set();
  return new Set(
    readFileSync(KNOWN_TERMS_FILE, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#')),
  );
}

describe('committed plugin references', () => {
  it('match what the generator produces from the real schemas', async () => {
    const files = await buildAllReferences();
    const stale = files.filter((file) => {
      const target = join(WORKSPACE_ROOT, file.relativePath);
      return !existsSync(target) || readFileSync(target, 'utf8') !== file.contents;
    });
    expect(stale.map((file) => file.relativePath), `Stale references; run: ${REGENERATE_COMMAND}`).toEqual([]);
  });

  it('cover the four schemas', () => {
    const paths = buildSchemaReferences().map((file) => file.relativePath.split('/').pop());
    expect(paths).toEqual(
      expect.arrayContaining(['timeline.md', 'motion-storyboard.md', 'motion-brief.md', 'brand.md', 'brand.schema.json']),
    );
  });
});

describe('SKILL.md field tokens (checked: backticked dot-paths, and any backticked identifier under a line mentioning "field" or "campo")', () => {
  const known = collectKnownFieldPaths();
  const allowlist = readKnownTerms();

  it('accepts a SKILL.md that only names real fields', () => {
    const markdown = '# Skill\n\nSet `brand` and `images[].caption` in the brief.\n';
    expect(findUnknownFieldTokens(markdown, known, new Set())).toEqual([]);
  });

  it('rejects a fixture SKILL.md that names a field no schema has', () => {
    const markdown = '# Skill\n\nThe brief field `bogusFieldName` and `scenes[].notARealField` are required.\n';
    expect(findUnknownFieldTokens(markdown, known, new Set())).toEqual(['bogusFieldName', 'scenes[].notARealField']);
  });

  it('rejects a backticked token named next to the brand manifest that the schema does not have', () => {
    const markdown = 'Mood goes in the manifest as `bogusMood`.\n';
    expect(findUnknownFieldTokens(markdown, known, new Set())).toEqual(['bogusMood']);
  });

  it('honors the allowlist for tool names, flags and file names', () => {
    const markdown = 'The field `render_project` is a tool.\n';
    expect(findUnknownFieldTokens(markdown, known, new Set(['render_project']))).toEqual([]);
  });

  it('passes for every SKILL.md under plugins/video-maker/skills (zero skills is valid)', () => {
    const offenders = listSkillFiles(SKILLS_DIR).flatMap((file) =>
      findUnknownFieldTokens(readFileSync(file, 'utf8'), known, allowlist).map((token) => `${file}: ${token}`),
    );
    expect(offenders).toEqual([]);
  });
});
