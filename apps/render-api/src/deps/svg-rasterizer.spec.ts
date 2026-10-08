import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { rasterizeSvgWithBrowser, resolveHeadlessBrowser, screenshotArguments, screenshotHtml } from './svg-rasterizer';

let root = '';

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'svg-rasterizer-'));
  await writeFile(join(root, 'logo.svg'), '<svg viewBox="0 0 4 1"/>');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('screenshot command', () => {
  it('asks for a transparent background at the requested window size', () => {
    const args = screenshotArguments('/tmp/a.html', '/tmp/out.png', '/tmp/profile', 1600, 400);

    expect(args).toContain('--default-background-color=00000000');
    expect(args).toContain('--window-size=1600,400');
    expect(args).toContain('--screenshot=/tmp/out.png');
    expect(args.at(-1)).toBe('file:///tmp/a.html');
  });

  it('embeds the SVG as a data URI sized to the raster', () => {
    const html = screenshotHtml('QUJD', 1600, 400);

    expect(html).toContain('data:image/svg+xml;base64,QUJD');
    expect(html).toContain('width:1600px;height:400px');
  });
});

describe('rasterizeSvgWithBrowser', () => {
  it('fails with the browser stderr when it exits non-zero', async () => {
    await expect(
      rasterizeSvgWithBrowser(
        { svgPath: join(root, 'logo.svg'), outPath: join(root, 'out.png'), widthPx: 100, heightPx: 25 },
        '/fake/browser',
        async () => ({ exitCode: 1, stderr: 'boom' }),
      ),
    ).rejects.toThrow(/boom/u);
  });

  it('fails when the browser exits 0 without writing the PNG', async () => {
    await expect(
      rasterizeSvgWithBrowser(
        { svgPath: join(root, 'logo.svg'), outPath: join(root, 'missing.png'), widthPx: 100, heightPx: 25 },
        '/fake/browser',
        async () => ({ exitCode: 0, stderr: '' }),
      ),
    ).rejects.toThrow(/without writing/u);
  });

  it('succeeds when the browser writes the PNG', async () => {
    const outPath = join(root, 'ok.png');
    await rasterizeSvgWithBrowser(
      { svgPath: join(root, 'logo.svg'), outPath, widthPx: 100, heightPx: 25 },
      '/fake/browser',
      async (_binary, args) => {
        const target = args.find((arg) => arg.startsWith('--screenshot='))?.slice('--screenshot='.length) ?? '';
        await writeFile(target, 'png');
        return { exitCode: 0, stderr: '' };
      },
    );
  });
});

describe('resolveHeadlessBrowser', () => {
  it('returns the configured executable when it exists', async () => {
    const configured = join(root, 'logo.svg');

    expect(await resolveHeadlessBrowser(configured, root)).toBe(configured);
  });

  it('answers null when nothing is configured and no Remotion browser lives above the directory', async () => {
    expect(await resolveHeadlessBrowser(join(root, 'nope'), root)).toBeNull();
  });
});
