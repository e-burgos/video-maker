import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, parse } from 'node:path';

import type { RasterizeSvgInput } from './render-api-dependencies';

const SCREENSHOT_TIMEOUT_MS = 60_000;
const VIRTUAL_TIME_BUDGET_MS = 3000;
const REMOTION_BROWSER_DIRECTORY = join('node_modules', '.remotion', 'chrome-headless-shell');
const BROWSER_BINARY_PREFIX = 'chrome-headless-shell';

export interface BrowserRunResult {
  readonly exitCode: number;
  readonly stderr: string;
}

export type BrowserRunner = (binary: string, args: readonly string[], timeoutMs: number) => Promise<BrowserRunResult>;

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function listDirectories(path: string): Promise<string[]> {
  try {
    return (await readdir(path, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function findRemotionBrowserFrom(startDirectory: string): Promise<string | null> {
  let directory = startDirectory;
  for (;;) {
    const root = join(directory, REMOTION_BROWSER_DIRECTORY);
    for (const platform of await listDirectories(root)) {
      for (const bundle of await listDirectories(join(root, platform))) {
        const candidate = join(root, platform, bundle, BROWSER_BINARY_PREFIX);
        if (await isFile(candidate)) {
          return candidate;
        }
      }
    }
    const parent = dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
}

export async function resolveHeadlessBrowser(configured: string | null, cwd: string): Promise<string | null> {
  if (configured !== null && (await isFile(configured))) {
    return configured;
  }
  return findRemotionBrowserFrom(cwd);
}

export function screenshotHtml(svgBase64: string, widthPx: number, heightPx: number): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}' +
    `img{display:block;width:${widthPx}px;height:${heightPx}px}</style></head>` +
    `<body><img src="data:image/svg+xml;base64,${svgBase64}"></body></html>`
  );
}

export function screenshotArguments(htmlPath: string, outPath: string, profileDirectory: string, widthPx: number, heightPx: number): string[] {
  return [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--user-data-dir=${profileDirectory}`,
    `--window-size=${widthPx},${heightPx}`,
    '--default-background-color=00000000',
    `--virtual-time-budget=${VIRTUAL_TIME_BUDGET_MS}`,
    `--screenshot=${outPath}`,
    `file://${htmlPath}`,
  ];
}

export async function rasterizeSvgWithBrowser(input: RasterizeSvgInput, browser: string, run: BrowserRunner): Promise<void> {
  const workDirectory = await mkdtemp(join(tmpdir(), 'brand-logo-'));
  try {
    const svg = await readFile(input.svgPath);
    const htmlPath = join(workDirectory, 'logo.html');
    await writeFile(htmlPath, screenshotHtml(svg.toString('base64'), input.widthPx, input.heightPx));
    const result = await run(
      browser,
      screenshotArguments(htmlPath, input.outPath, join(workDirectory, 'profile'), input.widthPx, input.heightPx),
      SCREENSHOT_TIMEOUT_MS,
    );
    if (result.exitCode !== 0 || !(await isFile(input.outPath))) {
      throw new Error(`browser exited ${result.exitCode} without writing ${parse(input.outPath).base}: ${result.stderr.slice(-300)}`);
    }
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}
