import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { assert, log, memoryGate, resolvePlaywright } from './smoke-helpers.mjs';

const WEB_PORT = process.env.WEB_PORT ?? '4212';
const SLUG = process.env.SLUG ?? 'timed-narration-smoke';
const FRAME_WIDTH = Number(process.env.FRAME_WIDTH ?? '1920');

const outPath = process.argv[2];
const frames = process.argv.slice(3);

if (outPath === undefined || frames.length === 0) {
  throw new Error(
    'usage: node apps/web/e2e/measure-caption-layout.mjs <out.json> <frame> [frame...] ' +
      '(render-api and apps/web must already be running against the project of SLUG)',
  );
}

function measureInPage() {
  const isCaptionWord = (node) =>
    node.style.whiteSpace === 'nowrap' && node.style.display === 'inline-block';

  const rows = new Map();
  for (const span of [...document.querySelectorAll('span')].filter(isCaptionWord)) {
    const rect = span.getBoundingClientRect();
    const key = Math.round(rect.top);
    const row = rows.get(key) ?? { left: Infinity, right: -Infinity, text: [] };
    row.left = Math.min(row.left, rect.left);
    row.right = Math.max(row.right, rect.right);
    row.text.push(span.textContent);
    rows.set(key, row);
  }

  const logo = [...document.querySelectorAll('img')].find((node) => node.src.includes('/logo/'));
  const logoRect = logo === undefined ? null : logo.getBoundingClientRect();
  const player = document.querySelector('[data-testid="timeline-player"]').getBoundingClientRect();

  return {
    playerLeft: player.left,
    playerWidth: player.width,
    lines: [...rows.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, row]) => ({ left: row.left, right: row.right, text: row.text.join(' ') })),
    logo: logoRect === null ? null : { left: logoRect.left, right: logoRect.right },
  };
}

async function main() {
  await memoryGate();

  const { chromium } = await resolvePlaywright();
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
  const measured = {};

  try {
    for (const frame of frames) {
      await page.goto(`http://localhost:${WEB_PORT}/projects/${SLUG}/preview?frame=${frame}`, {
        waitUntil: 'networkidle',
      });
      await page.waitForSelector('[data-testid="timeline-player"]');
      await page.waitForFunction(() => document.querySelector('video')?.readyState === 4, undefined, {
        timeout: 20_000,
      });

      const raw = await page.evaluate(measureInPage);
      const scale = raw.playerWidth / FRAME_WIDTH;
      const toFramePx = (value) => Math.round((value - raw.playerLeft) / scale);

      const lines = raw.lines.map((line) => ({
        text: line.text,
        leftPx: toFramePx(line.left),
        rightPx: toFramePx(line.right),
      }));
      const logo = raw.logo === null ? null : { leftPx: toFramePx(raw.logo.left), rightPx: toFramePx(raw.logo.right) };
      const gapToLogoPx =
        logo === null ? null : logo.leftPx - Math.max(...lines.map((line) => line.rightPx));

      measured[frame] = { seconds: Number(frame) / 30, captionLines: lines, logoPx: logo, gapToLogoPx };
      log('measure', `frame ${frame}: ${lines.length} line(s), gap to the logo ${gapToLogoPx} px`);

      assert(lines.length <= 2, `frame ${frame} renders at most two subtitle lines (got ${lines.length})`);
      if (gapToLogoPx !== null) {
        assert(gapToLogoPx > 0, `frame ${frame} keeps the subtitle clear of the logo (gap ${gapToLogoPx} px)`);
      }
    }

    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(
      outPath,
      `${JSON.stringify(
        {
          source: 'DOM measurement of the Remotion Player in apps/web, converted to frame pixels',
          slug: SLUG,
          frameWidth: FRAME_WIDTH,
          frames: measured,
        },
        null,
        2,
      )}\n`,
    );
    log('done', `wrote ${outPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  log('failed', error.stack ?? String(error));
  process.exitCode = 1;
});
