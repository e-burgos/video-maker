import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LOCALES } from './site-config.mjs';
import {
  DISTRIBUTION_KINDS,
  DISTRIBUTION_LABELS,
  MONOREPO_PROJECTS,
  TECH_CATEGORIES,
  TECH_ITEMS,
  licenseTokens,
} from './tech-inventory.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const NOTICES = readFileSync(join(REPO_ROOT, 'apps/desktop/vendor/THIRD_PARTY_NOTICES.md'), 'utf8');
const ROOT_PACKAGE = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
const DECLARED_DEPENDENCIES = { ...ROOT_PACKAGE.dependencies, ...ROOT_PACKAGE.devDependencies };
const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.html', '.css', '.toml']);
const SCAN_EXCLUDED_PATHS = [
  join(REPO_ROOT, 'apps/docs-site/src/tech-inventory.mjs'),
  join(REPO_ROOT, 'apps/docs-site/src/tech-inventory.spec.mjs'),
  join(REPO_ROOT, 'apps/docs-site/src/content'),
];

function noticesSection(heading) {
  const start = NOTICES.split('\n').findIndex((line) => line.trim() === heading);
  if (start === -1) {
    return null;
  }
  const lines = NOTICES.split('\n').slice(start + 1);
  const end = lines.findIndex((line) => line.startsWith('## '));
  return lines.slice(0, end === -1 ? undefined : end).join('\n');
}

function installedPackage(name) {
  return JSON.parse(readFileSync(join(REPO_ROOT, 'node_modules', name, 'package.json'), 'utf8'));
}

function listSubprojectDirectories() {
  return ['apps', 'libs', 'tools'].flatMap((group) =>
    readdirSync(join(REPO_ROOT, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => `${group}/${entry.name}`),
  );
}

function directoryMentions(directory, marker) {
  const needle = marker.toLowerCase();
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    if (SCAN_EXCLUDED_PATHS.some((excluded) => current.startsWith(excluded))) {
      continue;
    }
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
        continue;
      }
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (SCANNED_EXTENSIONS.has(extname(entry.name)) && statSync(entryPath).size < 2_000_000) {
        if (!SCAN_EXCLUDED_PATHS.includes(entryPath) && readFileSync(entryPath, 'utf8').toLowerCase().includes(needle)) {
          return true;
        }
      }
    }
  }
  return false;
}

describe('tech inventory', () => {
  it('has unique ids, known categories and known distribution kinds', () => {
    const ids = TECH_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categoryIds = TECH_CATEGORIES.map((category) => category.id);
    for (const item of TECH_ITEMS) {
      expect(categoryIds).toContain(item.category);
      expect(DISTRIBUTION_KINDS).toContain(item.distribution);
    }
    for (const categoryId of categoryIds) {
      expect(TECH_ITEMS.some((item) => item.category === categoryId)).toBe(true);
    }
  });

  it('localizes every text field in every locale', () => {
    const localizedFields = [
      ...TECH_CATEGORIES.flatMap((category) => [category.title, category.lede]),
      ...Object.values(DISTRIBUTION_LABELS),
      ...TECH_ITEMS.flatMap((item) => [item.what, item.why, item.warning, typeof item.license === 'string' ? undefined : item.license]),
      ...MONOREPO_PROJECTS.map((project) => project.what),
    ].filter((field) => field !== undefined);
    for (const field of localizedFields) {
      expect(Object.keys(field).sort()).toEqual([...LOCALES].sort());
      for (const locale of LOCALES) {
        expect(field[locale].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('lists every component that ships in or with the app in THIRD_PARTY_NOTICES.md with the same license and version', () => {
    for (const item of TECH_ITEMS.filter((candidate) => candidate.distribution === 'bundled' || candidate.distribution === 'first-run')) {
      expect(item.notices, `${item.id} must point to its THIRD_PARTY_NOTICES.md section`).not.toBeNull();
    }
    for (const item of TECH_ITEMS.filter((candidate) => candidate.notices !== null)) {
      const section = noticesSection(item.notices);
      expect(section, `${item.id}: heading "${item.notices}" not found`).not.toBeNull();
      for (const token of licenseTokens(item)) {
        expect(section, `${item.id}: license "${token}"`).toContain(token);
      }
      if (item.version !== undefined) {
        expect(section, `${item.id}: version ${item.version}`).toContain(item.version);
      }
    }
  });

  it('matches the license of every npm package installed in node_modules', () => {
    for (const item of TECH_ITEMS.filter((candidate) => candidate.npm !== null)) {
      expect(installedPackage(item.npm).license, item.id).toBe(item.npmLicenseField ?? item.license);
      for (const extra of item.extraNpm ?? []) {
        expect(installedPackage(extra.name).license, extra.name).toBe(extra.license);
      }
    }
  });

  it('shows npm versions only when the root package.json pins them exactly', () => {
    for (const item of TECH_ITEMS.filter((candidate) => candidate.npm !== null && candidate.version !== undefined)) {
      expect(DECLARED_DEPENDENCIES[item.npm], item.id).toBe(item.version);
      for (const extra of (item.extraNpm ?? []).filter((candidate) => candidate.version !== undefined)) {
        expect(DECLARED_DEPENDENCIES[extra.name], extra.name).toBe(extra.version);
      }
    }
  });

  it('points every item at subprojects that exist and actually mention it', () => {
    for (const item of TECH_ITEMS) {
      expect(item.usedBy.length, item.id).toBeGreaterThan(0);
      for (const projectPath of item.usedBy) {
        const absolute = join(REPO_ROOT, projectPath);
        expect(existsSync(absolute), `${item.id} → ${projectPath}`).toBe(true);
        expect(directoryMentions(absolute, item.codeMarker ?? item.npm ?? item.id), `${item.id} is not mentioned in ${projectPath}`).toBe(true);
      }
    }
  });

  it('lists exactly the subprojects that live in apps/, libs/ and tools/', () => {
    expect(MONOREPO_PROJECTS.map((project) => project.path).sort()).toEqual(listSubprojectDirectories().sort());
  });

  it('keeps the subproject count quoted in the Nx entry in sync', () => {
    const nx = TECH_ITEMS.find((item) => item.id === 'nx');
    for (const locale of LOCALES) {
      expect(nx.why[locale]).toContain(String(MONOREPO_PROJECTS.length));
    }
  });

  it('warns about the Remotion company license', () => {
    const remotion = TECH_ITEMS.find((item) => item.id === 'remotion');
    expect(remotion.licenseUrl).toBe('https://www.remotion.dev/license');
    expect(remotion.warning.es).toMatch(/licencia de empresa/);
    expect(remotion.warning.en).toMatch(/company license/);
  });
});
