import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const fontkit = require(resolve(repoRoot, 'node_modules/.pnpm/fontkit@2.0.4/node_modules/fontkit'));
const { chromium } = require(resolve(repoRoot, 'node_modules/.pnpm/playwright-core@1.62.0/node_modules/playwright-core'));

const outDir = resolve(here, 'final');
const fontDir = resolve(repoRoot, 'apps/docs-site/public/fonts');
const GRADIENT_START = '#ff5470';
const GRADIENT_END = '#7c5cff';
const INK_LIGHT = '#1d1d1f';
const INK_DARK = '#f5f5f7';

const loadFont = (weight) => fontkit.create(readFileSync(resolve(fontDir, `outfit-${weight}.woff2`)));
const fontSemibold = loadFont(600);
const fontRegular = loadFont(400);

const round = (value) => Math.round(value * 100) / 100;

const measureText = (font, text, size, tracking) => {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  return run.glyphs.reduce((total, glyph, index) => total + run.positions[index].xAdvance * scale + tracking, 0) - tracking;
};

const outlineText = (font, text, size, tracking, originX, baselineY) => {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  let cursor = originX;
  const paths = run.glyphs.map((glyph, index) => {
    const position = run.positions[index];
    const d = glyph.path.toSVG();
    const placed = d
      ? `<path d="${d}" transform="translate(${round(cursor + position.xOffset * scale)} ${round(baselineY - position.yOffset * scale)}) scale(${round(scale * 1000) / 1000} ${-round(scale * 1000) / 1000})"/>`
      : '';
    cursor += position.xAdvance * scale + tracking;
    return placed;
  });
  return { markup: paths.join(''), width: cursor - originX - tracking };
};

const vArms = (opacityLeft, opacityRight) =>
  `<g stroke-linecap="round" fill="none" stroke-width="14"><path d="M45 45 64 88" stroke="#fff" stroke-opacity="${opacityLeft}"/><path d="M83 45 64 88" stroke="#fff" stroke-opacity="${opacityRight}"/></g>`;

const lensGlyph = (strokeColor, fillOpacity) =>
  `<circle cx="64" cy="64" r="44" fill="${strokeColor}" fill-opacity="${fillOpacity}" stroke="${strokeColor}" stroke-opacity=".85" stroke-width="2.5"/><path d="M27.4 50.7A39 39 0 0 1 47.5 28.7" fill="none" stroke="${strokeColor}" stroke-opacity=".9" stroke-width="5" stroke-linecap="round"/>`;

const tileDefs = (idPrefix) =>
  `<defs><linearGradient id="${idPrefix}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GRADIENT_START}"/><stop offset="1" stop-color="${GRADIENT_END}"/></linearGradient><linearGradient id="${idPrefix}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="${idPrefix}s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#2a1a6e" flood-opacity=".35"/></filter></defs>`;

const tileBody = (idPrefix) =>
  `<rect width="128" height="128" rx="29" fill="url(#${idPrefix}g)"/><rect width="128" height="128" rx="29" fill="url(#${idPrefix}h)"/><rect x=".75" y=".75" width="126.5" height="126.5" rx="28.5" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>${lensGlyph('#fff', 0.2)}<g filter="url(#${idPrefix}s)">${vArms(0.95, 0.55)}</g>`;

const markSvg = (idPrefix, size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128" role="img" aria-label="Video Maker">${tileDefs(idPrefix)}${tileBody(idPrefix)}</svg>`;

const glyphSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="Video Maker" color="currentColor"><g fill="none" stroke="currentColor">${`<circle cx="64" cy="64" r="44" stroke-opacity=".85" stroke-width="2.5"/>`}<path d="M27.4 50.7A39 39 0 0 1 47.5 28.7" stroke-opacity=".9" stroke-width="5" stroke-linecap="round"/><g stroke-linecap="round" stroke-width="14"><path d="M45 45 64 88" stroke-opacity=".95"/><path d="M83 45 64 88" stroke-opacity=".55"/></g></g></svg>`;

const appIconSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><filter id="shadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#1a1040" flood-opacity=".35"/></filter></defs><g filter="url(#shadow)"><g transform="translate(100 100) scale(6.4375)">${tileDefs('a')}${tileBody('a')}</g></g></svg>`;

const wordmarkParts = (ink, size, originX, baselineY) => {
  const video = outlineText(fontSemibold, 'Video', size, -size * 0.02, originX, baselineY);
  const gap = size * 0.28;
  const maker = outlineText(fontRegular, 'Maker', size, -size * 0.02, originX + video.width + gap, baselineY);
  return { width: video.width + gap + maker.width, markup: `<g fill="${ink}">${video.markup}</g><g fill="${ink}" fill-opacity=".78">${maker.markup}</g>` };
};

const byLine = (ink, size, originX, baselineY) => {
  const tracking = size * 0.06;
  const line = outlineText(fontRegular, 'by Esteban Burgos', size, tracking, originX, baselineY);
  return { width: line.width, markup: `<g fill="${ink}" fill-opacity=".62">${line.markup}</g>` };
};

const horizontalLockup = (ink, idPrefix) => {
  const markSize = 56;
  const nameSize = 34;
  const bySize = 12.5;
  const textX = markSize + 16;
  const name = wordmarkParts(ink, nameSize, textX, 30);
  const by = byLine(ink, bySize, textX, 48);
  const width = Math.ceil(textX + Math.max(name.width, by.width)) + 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${markSize}" viewBox="0 0 ${width} ${markSize}" role="img" aria-label="Video Maker by Esteban Burgos"><g transform="scale(${markSize / 128})">${tileDefs(idPrefix)}${tileBody(idPrefix)}</g>${name.markup}${by.markup}</svg>`;
};

const verticalLockup = (ink, idPrefix) => {
  const markSize = 96;
  const nameSize = 38;
  const bySize = 13;
  const name = wordmarkParts(ink, nameSize, 0, 0);
  const by = byLine(ink, bySize, 0, 0);
  const width = Math.ceil(Math.max(name.width, by.width, markSize)) + 4;
  const nameX = (width - name.width) / 2;
  const byX = (width - by.width) / 2;
  const nameLine = wordmarkParts(ink, nameSize, nameX, markSize + 14 + nameSize * 0.72);
  const byLineMarkup = byLine(ink, bySize, byX, markSize + 14 + nameSize * 0.72 + 24);
  const height = Math.ceil(markSize + 14 + nameSize * 0.72 + 30);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Video Maker by Esteban Burgos"><g transform="translate(${(width - markSize) / 2} 0) scale(${markSize / 128})">${tileDefs(idPrefix)}${tileBody(idPrefix)}</g>${nameLine.markup}${byLineMarkup.markup}</svg>`;
};

const wordmarkOnly = () => {
  const size = 34;
  const name = wordmarkParts('currentColor', size, 0, size * 0.74);
  const by = byLine('currentColor', 12.5, 0, size * 0.74 + 18);
  const width = Math.ceil(Math.max(name.width, by.width)) + 2;
  const height = Math.ceil(size * 0.74 + 24);
  return { width, height, markup: `${name.markup}${by.markup}`, nameMarkup: name.markup, byMarkup: by.markup, nameWidth: name.width, byWidth: by.width };
};

const brandMarkComponent = (wordmark) =>
  `import type { SVGProps } from 'react';

type BrandMarkProps = SVGProps<SVGSVGElement> & { label: string; size?: number };

export function BrandMark({ label, size = 28, ...rest }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" role="img" aria-label={label} {...rest}>
      <defs>
        <linearGradient id="brand-mark-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="${GRADIENT_START}" />
          <stop offset="1" stopColor="${GRADIENT_END}" />
        </linearGradient>
        <linearGradient id="brand-mark-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".4" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="brand-mark-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#2a1a6e" floodOpacity=".35" />
        </filter>
      </defs>
      <rect width="128" height="128" rx="29" fill="url(#brand-mark-fill)" />
      <rect width="128" height="128" rx="29" fill="url(#brand-mark-sheen)" />
      <rect x=".75" y=".75" width="126.5" height="126.5" rx="28.5" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" />
      <circle cx="64" cy="64" r="44" fill="#fff" fillOpacity=".2" stroke="#fff" strokeOpacity=".85" strokeWidth="2.5" />
      <path d="M27.4 50.7A39 39 0 0 1 47.5 28.7" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="5" strokeLinecap="round" />
      <g filter="url(#brand-mark-shadow)" strokeLinecap="round" fill="none" strokeWidth="14">
        <path d="M45 45 64 88" stroke="#fff" strokeOpacity=".95" />
        <path d="M83 45 64 88" stroke="#fff" strokeOpacity=".55" />
      </g>
    </svg>
  );
}

type BrandWordmarkProps = SVGProps<SVGSVGElement> & { label: string; height?: number; withSignature?: boolean };

export function BrandWordmark({ label, height = 28, withSignature = true, ...rest }: BrandWordmarkProps) {
  const viewHeight = withSignature ? ${wordmark.height} : ${Math.ceil(wordmark.height - 22)};
  const width = (${wordmark.width} / ${wordmark.height}) * height;
  return (
    <svg
      width={withSignature ? width : (${Math.ceil(wordmark.nameWidth) + 2} / viewHeight) * height}
      height={height}
      viewBox={\`0 0 \${withSignature ? ${wordmark.width} : ${Math.ceil(wordmark.nameWidth) + 2}} \${viewHeight}\`}
      role="img"
      aria-label={label}
      {...rest}
    >
      ${wordmark.nameMarkup.replace(/<g fill="currentColor"/g, '<g fill="currentColor"').replace(/fill-opacity/g, 'fillOpacity')}
      {withSignature && (<>${wordmark.byMarkup.replace(/fill-opacity/g, 'fillOpacity')}</>)}
    </svg>
  );
}
`;

mkdirSync(outDir, { recursive: true });

const files = {
  'mark.svg': markSvg('m', 128),
  'glyph.svg': glyphSvg(),
  'app-icon.svg': appIconSvg(),
  'lockup-horizontal-light.svg': horizontalLockup(INK_LIGHT, 'hl'),
  'lockup-horizontal-dark.svg': horizontalLockup(INK_DARK, 'hd'),
  'lockup-vertical-light.svg': verticalLockup(INK_LIGHT, 'vl'),
  'lockup-vertical-dark.svg': verticalLockup(INK_DARK, 'vd'),
};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(resolve(outDir, name), content);
}

const wordmark = wordmarkOnly();
writeFileSync(resolve(repoRoot, 'apps/web/src/components/ui/brand-mark.tsx'), brandMarkComponent(wordmark));
mkdirSync(resolve(repoRoot, 'apps/web/public'), { recursive: true });
copyFileSync(resolve(outDir, 'mark.svg'), resolve(repoRoot, 'apps/web/public/favicon.svg'));

const browser = await chromium.launch();
const renderPng = async (svgName, size, target, transparent = true) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const svg = readFileSync(resolve(outDir, svgName), 'utf8');
  await page.setContent(`<body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}"/></body>`);
  await page.screenshot({ path: target, omitBackground: transparent });
  await page.close();
};

const iconset = resolve(outDir, 'icon.iconset');
rmSync(iconset, { recursive: true, force: true });
mkdirSync(iconset, { recursive: true });
const iconSizes = [[16, 1], [16, 2], [32, 1], [32, 2], [128, 1], [128, 2], [256, 1], [256, 2], [512, 1], [512, 2]];
for (const [base, density] of iconSizes) {
  const suffix = density === 2 ? '@2x' : '';
  await renderPng('app-icon.svg', base * density, resolve(iconset, `icon_${base}x${base}${suffix}.png`));
}
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', resolve(outDir, 'icon.icns')]);
await renderPng('app-icon.svg', 1024, resolve(outDir, 'icon-1024.png'));
for (const size of [16, 32, 64, 180]) {
  await renderPng('mark.svg', size, resolve(outDir, `favicon-${size}.png`));
}
await browser.close();
rmSync(iconset, { recursive: true, force: true });

mkdirSync(resolve(repoRoot, 'apps/desktop/build'), { recursive: true });
copyFileSync(resolve(outDir, 'icon.icns'), resolve(repoRoot, 'apps/desktop/build/icon.icns'));
copyFileSync(resolve(outDir, 'icon-1024.png'), resolve(repoRoot, 'apps/desktop/build/icon.png'));
console.log('logo generado en', outDir);
