import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RELEASE_REPO,
  buildGhReleaseCreateArgs,
  extractChangelogSection,
  formatGhCommand,
  formatSha256Line,
  parseReleaseArgs,
} from './release-desktop.mjs';

describe('parseReleaseArgs', () => {
  it('defaults to dry-run and the default repo with no arguments', () => {
    expect(parseReleaseArgs([])).toEqual({ publish: false, repo: DEFAULT_RELEASE_REPO });
  });

  it('turns on publish with --publish', () => {
    expect(parseReleaseArgs(['--publish'])).toEqual({ publish: true, repo: DEFAULT_RELEASE_REPO });
  });

  it('overrides the repo with --repo=owner/name', () => {
    expect(parseReleaseArgs(['--repo=someone/else'])).toEqual({ publish: false, repo: 'someone/else' });
  });

  it('accepts --repo and --publish together in either order', () => {
    expect(parseReleaseArgs(['--repo=someone/else', '--publish'])).toEqual({
      publish: true,
      repo: 'someone/else',
    });
    expect(parseReleaseArgs(['--publish', '--repo=someone/else'])).toEqual({
      publish: true,
      repo: 'someone/else',
    });
  });

  it('rejects a repo argument without an owner/name shape', () => {
    expect(() => parseReleaseArgs(['--repo=not-a-repo'])).toThrow(/owner\/name/);
  });

  it('rejects an unrecognized argument', () => {
    expect(() => parseReleaseArgs(['--bogus'])).toThrow(/unrecognized argument/);
  });
});

describe('extractChangelogSection', () => {
  const changelog = [
    '# Changelog',
    '',
    '## 0.1.0 — Primera versión para amigos',
    '',
    'Línea uno.',
    'Línea dos.',
    '',
    '## 0.0.9 — Interna',
    '',
    'Nunca publicada.',
    '',
  ].join('\n');

  it('extracts the title and body of the requested version', () => {
    const { title, body } = extractChangelogSection(changelog, '0.1.0');
    expect(title).toBe('0.1.0 — Primera versión para amigos');
    expect(body).toBe('Línea uno.\nLínea dos.');
  });

  it('stops before the next version heading', () => {
    const { body } = extractChangelogSection(changelog, '0.1.0');
    expect(body).not.toContain('Nunca publicada');
  });

  it('extracts the last section in the file up to its end', () => {
    const { body } = extractChangelogSection(changelog, '0.0.9');
    expect(body).toBe('Nunca publicada.');
  });

  it('throws when the version has no section', () => {
    expect(() => extractChangelogSection(changelog, '9.9.9')).toThrow(/9\.9\.9/);
  });
});

describe('formatSha256Line', () => {
  it('formats like sha256sum output', () => {
    expect(formatSha256Line('abc123', 'Video-Maker-arm64.dmg')).toBe('abc123  Video-Maker-arm64.dmg\n');
  });
});

describe('buildGhReleaseCreateArgs', () => {
  it('builds the gh release create argv in the expected order', () => {
    const args = buildGhReleaseCreateArgs({
      version: '0.1.0',
      repo: DEFAULT_RELEASE_REPO,
      title: 'Video Maker 0.1.0',
      notesFilePath: '/tmp/release-notes.md',
      assetPaths: ['/tmp/a.dmg', '/tmp/b.dmg'],
    });

    expect(args).toEqual([
      'release',
      'create',
      'v0.1.0',
      '/tmp/a.dmg',
      '/tmp/b.dmg',
      '--repo',
      DEFAULT_RELEASE_REPO,
      '--title',
      'Video Maker 0.1.0',
      '--notes-file',
      '/tmp/release-notes.md',
    ]);
  });
});

describe('formatGhCommand', () => {
  it('quotes arguments that contain whitespace', () => {
    expect(formatGhCommand(['release', 'create', '--title', 'Video Maker 0.1.0'])).toBe(
      'gh release create --title "Video Maker 0.1.0"',
    );
  });

  it('leaves plain arguments unquoted', () => {
    expect(formatGhCommand(['release', 'create', 'v0.1.0'])).toBe('gh release create v0.1.0');
  });
});
