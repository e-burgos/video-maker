import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';

const WEB_PORT = process.env.WEB_PORT ?? '4207';
const SLUG = process.env.SLUG ?? 'smoke-ingest';
const FRAME = process.env.FRAME ?? '240';

const outDir = process.argv[2];
const outFile = process.argv[3] ?? 'player-frame-240.png';

if (outDir === undefined) {
  throw new Error(
    'usage: node apps/web/e2e/capture-frame-240.mjs <outDir> [outFile] ' +
      '(render-api and apps/web must already be running — see frame-parity-8s.md)',
  );
}

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  log('assert', `ok — ${message}`);
}

function memoryGate() {
  log('0', 'memory gate');
  let heavyProcesses = '';
  try {
    heavyProcesses = execSync("pgrep -fl 'ffmpeg|whisper-cli|chrome-headless' || true", {
      encoding: 'utf8',
    }).trim();
  } catch {
    heavyProcesses = '';
  }
  assert(heavyProcesses === '', `no ffmpeg/whisper-cli/chrome-headless process alive (found: ${heavyProcesses || 'none'})`);

  try {
    const pressure = execSync('memory_pressure | tail -2', { encoding: 'utf8' }).trim();
    log('0', pressure);
  } catch {
    log('0', 'memory_pressure not available on this platform, continuing');
  }
}

async function resolvePlaywright() {
  try {
    return await import('playwright');
  } catch {
    // fall through to the npx cache below — playwright is never a package.json dependency here
  }

  const npxRoot = join(homedir(), '.npm', '_npx');
  let entries = [];
  try {
    entries = await readdir(npxRoot);
  } catch {
    entries = [];
  }

  for (const entry of entries) {
    const candidate = join(npxRoot, entry, 'node_modules', 'playwright', 'index.mjs');
    try {
      return await import(candidate);
    } catch {
      continue;
    }
  }

  throw new Error(
    'playwright not found. Run `npx playwright install` once on this machine (never add it to ' +
      'package.json) so this script can find it under ~/.npm/_npx/*/node_modules/playwright.',
  );
}

async function main() {
  memoryGate();

  const { chromium } = await resolvePlaywright();
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 2200 } });

  try {
    log('1', `opening the preview at initialFrame=${FRAME}, no render, Player only`);
    await page.goto(`http://localhost:${WEB_PORT}/projects/${SLUG}/preview?frame=${FRAME}`, {
      waitUntil: 'networkidle',
    });

    await page.waitForSelector('[data-testid="timeline-player"]');

    await page.waitForFunction(
      () => {
        const video = document.querySelector('video');
        return video !== null && video.readyState === 4 && video.videoWidth > 0;
      },
      undefined,
      { timeout: 15000 },
    );

    const state = await page.evaluate(() => {
      const video = document.querySelector('video');
      return {
        readyState: video.readyState,
        currentTime: video.currentTime,
        paused: video.paused,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        duration: video.duration,
      };
    });
    log('1', `video state at initialFrame=${FRAME}: ${JSON.stringify(state)}`);

    const container = page.locator('[data-testid="timeline-player"]');
    const outPath = `${outDir}/${outFile}`;
    await container.screenshot({ path: outPath });
    log('done', `saved ${outPath}`);
  } finally {
    await browser.close();
  }
}

await main();
