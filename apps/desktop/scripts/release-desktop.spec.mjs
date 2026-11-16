import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DOWNLOADS_BUCKET,
  DOWNLOADS_DOMAIN,
  R2_SINGLE_UPLOAD_LIMIT_BYTES,
  UPDATE_MANIFEST_KEY,
  buildHdiutilLzmaConvertArgs,
  buildUpdateManifest,
  exceedsR2UploadLimit,
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

describe('buildWranglerR2PutArgs with a content type', () => {
  it('uploads the update manifest as JSON', () => {
    const args = buildWranglerR2PutArgs({
      bucket: DEFAULT_DOWNLOADS_BUCKET,
      key: UPDATE_MANIFEST_KEY,
      filePath: '/tmp/latest.json',
      contentType: 'application/json',
    });

    expect(args).toContain(`${DEFAULT_DOWNLOADS_BUCKET}/latest.json`);
    expect(args[args.indexOf('--content-type') + 1]).toBe('application/json');
  });
});

describe('buildUpdateManifest', () => {
  it('points at the stable dmg and carries version, hash and date', () => {
    expect(
      buildUpdateManifest({
        version: '0.4.0',
        stableDmgName: 'Video-Maker-arm64.dmg',
        sha256: 'abc123',
        publishedAt: '2026-11-13T12:00:00.000Z',
      }),
    ).toEqual({
      version: '0.4.0',
      url: `${DOWNLOADS_DOMAIN}/descargas/Video-Maker-arm64.dmg`,
      sha256: 'abc123',
      publishedAt: '2026-11-13T12:00:00.000Z',
    });
  });

  it('publishes the manifest under descargas/latest.json', () => {
    expect(downloadUrlFor(UPDATE_MANIFEST_KEY)).toBe(`${DOWNLOADS_DOMAIN}/descargas/latest.json`);
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

describe('buildHdiutilLzmaConvertArgs', () => {
  it('converts the dmg to ULMO at the output path', () => {
    expect(buildHdiutilLzmaConvertArgs({ sourcePath: '/d/a.dmg', outputPath: '/d/a.lzma.dmg' })).toEqual([
      'convert',
      '/d/a.dmg',
      '-format',
      'ULMO',
      '-o',
      '/d/a.lzma.dmg',
    ]);
  });
});

describe('exceedsR2UploadLimit', () => {
  it('accepts a file exactly at the 300 MiB limit', () => {
    expect(exceedsR2UploadLimit(R2_SINGLE_UPLOAD_LIMIT_BYTES)).toBe(false);
  });

  it('rejects a file one byte above the limit', () => {
    expect(exceedsR2UploadLimit(R2_SINGLE_UPLOAD_LIMIT_BYTES + 1)).toBe(true);
  });
});
