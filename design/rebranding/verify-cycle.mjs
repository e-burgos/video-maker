import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = resolve(import.meta.dirname, '../..');
const { chromium } = require(resolve(repoRoot, 'node_modules/.pnpm/playwright-core@1.62.0/node_modules/playwright-core'));

const baseUrl = process.env.STUDIO_URL ?? 'http://localhost:4200';
const outputDir = resolve(repoRoot, process.argv[2]);
const footageSlug = process.env.FOOTAGE_SLUG ?? 'crear-campana-display-ads';
const motionSlug = process.env.MOTION_SLUG ?? 'li-video-maker-agentes';
mkdirSync(outputDir, { recursive: true });

const SCREENS = [
  ['videos', '/'],
  ['guia', '/guide'],
  ['marcas', '/brands'],
  ['marca-editor', '/brands/displayads'],
  ['publicacion', '/publish-queue'],
  ['ajustes', '/settings'],
  ['productor', `/projects/${footageSlug}`],
  ['biblioteca', `/projects/${footageSlug}/library`],
  ['storyboard', `/projects/${footageSlug}/storyboard`],
  ['voz', `/projects/${footageSlug}/voice`],
  ['vista-previa', `/projects/${footageSlug}/preview`],
  ['motion', `/projects/${motionSlug}/motion`],
];

const CONTRAST_TARGETS = [
  ['sidebar · rótulo de sección', '[data-testid=shell-sidebar] p'],
  ['sidebar · ítem', '[data-testid=shell-sidebar] nav a:not([aria-current])'],
  ['sidebar · ítem activo', '[data-testid=shell-sidebar] nav a[aria-current=page]'],
  ['bloque del video · título', '[data-testid=video-block] > p'],
  ['bloque del video · paso', '[data-testid=project-nav] a:not([aria-current])'],
  ['bloque del video · paso activo', '[data-testid=project-nav] a[aria-current=page]'],
  ['toolbar · título', '[data-testid=shell-toolbar] h1'],
  ['toolbar · subtítulo', '[data-testid=shell-toolbar] h1 + *'],
];

const parseColor = (value) => {
  const match = value.match(/rgba?\(([^)]+)\)/u);
  if (!match) return null;
  const [r, g, b, a = 1] = match[1].split(/[ ,/]+/u).filter(Boolean).map(Number);
  return { r, g, b, a };
};

const blend = (foreground, background) => ({
  r: foreground.r * foreground.a + background.r * (1 - foreground.a),
  g: foreground.g * foreground.a + background.g * (1 - foreground.a),
  b: foreground.b * foreground.a + background.b * (1 - foreground.a),
});

const luminance = ({ r, g, b }) => {
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

async function sampleBackground(page, box) {
  const points = [];
  for (const fx of [0.1, 0.5, 0.9]) {
    for (const fy of [0.2, 0.5, 0.8]) {
      points.push({ x: Math.round(box.x + box.width * fx), y: Math.round(box.y + box.height * fy) });
    }
  }
  const image = await page.screenshot({ type: 'png' });
  const colors = await page.evaluate(
    async ({ base64, samplePoints }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      return samplePoints.map(({ x, y }) => Array.from(context.getImageData(x, y, 1, 1).data));
    },
    { base64: image.toString('base64'), samplePoints: points },
  );
  return {
    r: median(colors.map((color) => color[0])),
    g: median(colors.map((color) => color[1])),
    b: median(colors.map((color) => color[2])),
  };
}

async function measureContrast(page, scheme) {
  const results = [];
  for (const [name, selector] of CONTRAST_TARGETS) {
    const handle = await page.$(selector);
    if (!handle) {
      results.push({ name, scheme, skipped: true });
      continue;
    }
    const { box, color, fontSize } = await handle.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, color: style.color, fontSize: parseFloat(style.fontSize) };
    });
    await page.addStyleTag({ content: '[data-testid=shell-sidebar] *, [data-testid=shell-toolbar] * { color: transparent !important; } svg { visibility: hidden !important; }' });
    const background = await sampleBackground(page, box);
    await page.evaluate(() => document.querySelectorAll('style:last-of-type').forEach((node) => node.textContent?.includes('color: transparent') && node.remove()));
    const foreground = parseColor(color);
    const effective = blend(foreground, background);
    results.push({ name, scheme, ratio: Math.round(contrastRatio(effective, background) * 100) / 100, fontSize, color });
  }
  return results;
}

async function measureFrameRate(page) {
  return page.evaluate(
    () =>
      new Promise((done) => {
        const scroller = document.querySelector('[data-testid=shell-content]');
        let frames = 0;
        const started = performance.now();
        const step = (now) => {
          frames += 1;
          if (scroller) scroller.scrollTop = ((now - started) / 4) % Math.max(1, scroller.scrollHeight - scroller.clientHeight);
          if (now - started < 3000) requestAnimationFrame(step);
          else done(Math.round((frames / ((now - started) / 1000)) * 10) / 10);
        };
        requestAnimationFrame(step);
      }),
  );
}

const report = { baseUrl, capturedAt: new Date().toISOString(), screens: [], contrast: [], reducedMotion: null, solidMaterial: null, frameRate: null, consoleErrors: [] };
const browser = await chromium.launch();

for (const scheme of ['light', 'dark']) {
  for (const [width, height, tag] of [[1440, 900, '1440'], [900, 700, '900']]) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
    const page = await context.newPage();
    page.on('console', (message) => message.type() === 'error' && report.consoleErrors.push(`${scheme}/${tag}: ${message.text().slice(0, 120)}`));
    for (const [name, path] of SCREENS) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' }).catch(() => undefined);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${outputDir}/task006-${name}-${scheme}-${tag}.png` });
      if (scheme === 'light' && tag === '1440') report.screens.push(name);
    }
    if (tag === '1440') {
      await page.goto(`${baseUrl}/projects/${footageSlug}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      report.contrast.push(...(await measureContrast(page, scheme)));
    }
    await context.close();
  }
}

const solidContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const solidPage = await solidContext.newPage();
await solidPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
const glassBackdrop = await solidPage.$eval('[data-testid=shell-sidebar]', (element) => getComputedStyle(element).backdropFilter);
report.frameRate = { glass: await measureFrameRate(solidPage) };
await solidPage.evaluate(() => document.documentElement.setAttribute('data-material', 'solid'));
const solidBackdrop = await solidPage.$eval('[data-testid=shell-sidebar]', (element) => getComputedStyle(element).backdropFilter);
report.frameRate.solid = await measureFrameRate(solidPage);
report.solidMaterial = { glassBackdrop, solidBackdrop };
await solidContext.close();

const motionContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const motionPage = await motionContext.newPage();
await motionPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
report.reducedMotion = await motionPage.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
await motionContext.close();

const transparencyContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const transparencyPage = await transparencyContext.newPage();
await transparencyPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
const session = await transparencyContext.newCDPSession(transparencyPage);
await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
report.reducedTransparency = {
  matches: await transparencyPage.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches),
  sidebarBackdrop: await transparencyPage.$eval('[data-testid=shell-sidebar]', (element) => getComputedStyle(element).backdropFilter),
};
await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-contrast', value: 'more' }] });
report.contrastMore = await transparencyPage.$eval('[data-testid=shell-sidebar]', (element) => getComputedStyle(element).borderTopWidth);
await transparencyContext.close();

await browser.close();
writeFileSync(`${outputDir}/task006-verificacion.json`, `${JSON.stringify(report, null, 2)}\n`);
const failing = report.contrast.filter((entry) => !entry.skipped && entry.ratio < 4.5);
console.log(JSON.stringify({ capturas: report.screens.length * 4 * 2, erroresConsola: report.consoleErrors.length, contrasteBajo45: failing, solidMaterial: report.solidMaterial, fps: report.frameRate, reducedMotion: report.reducedMotion, reducedTransparency: report.reducedTransparency, contrastMore: report.contrastMore }, null, 2));
