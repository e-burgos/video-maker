import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DOWNLOADS_BUCKET,
  DOWNLOADS_DOMAIN,
  buildWranglerR2PutArgs,
  downloadUrlFor,
  extractChangelogSection,
  formatPnpmCommand,
  formatSha256Line,
  parseReleaseArgs,
} from './release-desktop.mjs';

describe('parseReleaseArgs', () => {
  it('defaults to dry-run and the default bucket with no arguments', () => {
    expect(parseReleaseArgs([])).toEqual({ publish: false, bucket: DEFAULT_DOWNLOADS_BUCKET });
  });

  it('turns on publish with --publish', () => {
    expect(parseReleaseArgs(['--publish'])).toEqual({ publish: true, bucket: DEFAULT_DOWNLOADS_BUCKET });
  });

  it('overrides the bucket with --bucket=name', () => {
    expect(parseReleaseArgs(['--bucket=some-other-bucket'])).toEqual({ publish: false, bucket: 'some-other-bucket' });
  });

  it('accepts --bucket and --publish together in either order', () => {
    expect(parseReleaseArgs(['--bucket=some-other-bucket', '--publish'])).toEqual({
      publish: true,
      bucket: 'some-other-bucket',
    });
    expect(parseReleaseArgs(['--publish', '--bucket=some-other-bucket'])).toEqual({
      publish: true,
      bucket: 'some-other-bucket',
    });
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

describe('downloadUrlFor', () => {
  it('builds the descargas URL under the custom domain', () => {
    expect(downloadUrlFor('Video-Maker-arm64.dmg')).toBe(`${DOWNLOADS_DOMAIN}/descargas/Video-Maker-arm64.dmg`);
  });
});

describe('buildWranglerR2PutArgs', () => {
  it('builds the wrangler r2 object put argv in the expected order', () => {
    const args = buildWranglerR2PutArgs({
      bucket: DEFAULT_DOWNLOADS_BUCKET,
      key: 'Video-Maker-arm64.dmg',
      filePath: '/tmp/Video-Maker-arm64.dmg',
    });

    expect(args).toEqual([
      'dlx',
      'wrangler@4',
      'r2',
      'object',
      'put',
      `${DEFAULT_DOWNLOADS_BUCKET}/Video-Maker-arm64.dmg`,
      '--file',
      '/tmp/Video-Maker-arm64.dmg',
      '--content-type',
      'application/x-apple-diskimage',
      '--remote',
    ]);
  });
});

describe('formatPnpmCommand', () => {
  it('quotes arguments that contain whitespace', () => {
    expect(formatPnpmCommand(['dlx', 'wrangler@4', '--help', 'a b'])).toBe('pnpm dlx wrangler@4 --help "a b"');
  });

  it('leaves plain arguments unquoted', () => {
    expect(formatPnpmCommand(['dlx', 'wrangler@4', 'whoami'])).toBe('pnpm dlx wrangler@4 whoami');
  });
});
