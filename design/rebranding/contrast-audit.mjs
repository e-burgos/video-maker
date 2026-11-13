import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = resolve(import.meta.dirname, '../..');
const { chromium } = require(resolve(repoRoot, 'node_modules/.pnpm/playwright-core@1.62.0/node_modules/playwright-core'));

const baseUrl = process.env.STUDIO_URL ?? 'http://localhost:4200';
const [outputArg, ...paths] = process.argv.slice(2);
const outputDir = resolve(repoRoot, outputArg);
mkdirSync(outputDir, { recursive: true });

const luminance = ([r, g, b]) => {
  const channel = (value) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrastRatio = (first, second) => {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function collectTextTargets(page) {
  return page.evaluate(() => {
    const parse = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/u);
      if (!match) return null;
      const parts = match[1].split(/[ ,/]+/u).filter(Boolean).map(Number);
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
    };
    const insideMedia = (element) => element.closest('video, img, canvas, [data-surface=legacy], [data-media]') !== null;
    const targets = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      if (!element || seen.has(element) || node.textContent.trim().length === 0) continue;
      seen.add(element);
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
      if (rect.width < 4 || rect.height < 4 || rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
      if (insideMedia(element) || element.closest('[aria-hidden=true]')) continue;
      const color = parse(style.color);
      if (!color) continue;
      const fontSize = parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const large = fontSize >= 24 || (bold && fontSize >= 18.66);
      const disabled = element.closest('[disabled], [aria-disabled=true]') !== null;
      targets.push({
        text: node.textContent.trim().slice(0, 40),
        color,
        large,
        disabled,
        box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });
    }
    return targets.slice(0, 500);
  });
}

async function sampleBackgrounds(page, targets) {
  const style = await page.addStyleTag({ content: '* { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } svg { visibility: hidden !important; }' });
  const image = await page.screenshot({ type: 'png' });
  await style.evaluate((node) => node.remove());
  return page.evaluate(
    async ({ base64, boxes }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const scale = bitmap.width / innerWidth;
      return boxes.map((box) => {
        const samples = [];
        for (const fx of [0.15, 0.5, 0.85]) {
          for (const fy of [0.25, 0.5, 0.75]) {
            const x = Math.min(bitmap.width - 1, Math.max(0, Math.round((box.x + box.width * fx) * scale)));
            const y = Math.min(bitmap.height - 1, Math.max(0, Math.round((box.y + box.height * fy) * scale)));
            samples.push(Array.from(context.getImageData(x, y, 1, 1).data));
          }
        }
        return samples;
      });
    },
    { base64: image.toString('base64'), boxes: targets.map((target) => target.box) },
  );
}

const report = { baseUrl, audited: [], failures: [] };
const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  const page = await context.newPage();
  for (const path of paths) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const targets = await collectTextTargets(page);
    const samples = await sampleBackgrounds(page, targets);
    let checked = 0;
    targets.forEach((target, index) => {
      const background = [0, 1, 2].map((channel) => median(samples[index].map((sample) => sample[channel])));
      const { r, g, b, a } = target.color;
      const effective = [r * a + background[0] * (1 - a), g * a + background[1] * (1 - a), b * a + background[2] * (1 - a)];
      const ratio = Math.round(contrastRatio(effective, background) * 100) / 100;
      const required = target.large ? 3 : 4.5;
      checked += 1;
      if (!target.disabled && ratio < required) {
        report.failures.push({ scheme, path, text: target.text, ratio, required });
      }
    });
    report.audited.push({ scheme, path, textsChecked: checked, horizontalOverflowPx: overflow });
  }
  await context.close();
}
await browser.close();
writeFileSync(resolve(outputDir, 'contrast-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ audited: report.audited, failures: report.failures.slice(0, 40), totalFailures: report.failures.length }, null, 1));
