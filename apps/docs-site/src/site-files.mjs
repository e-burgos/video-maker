import { APP_DISPLAY_NAME, BRAND_THEME_COLOR, DEFAULT_LOCALE, LOCALES, PAGES } from './site-config.mjs';
import { t } from './i18n.mjs';
import { absoluteUrl, alternateLinks, canonicalUrl } from './routes.mjs';

export const CLIENT_SCRIPT_FILES = ['site.mjs', 'site-logic.mjs'];

export const SITE_ICON_FILES = ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

export function buildWebManifest() {
  const manifest = {
    name: APP_DISPLAY_NAME,
    short_name: APP_DISPLAY_NAME,
    description: t(DEFAULT_LOCALE, 'brand.tagline'),
    lang: DEFAULT_LOCALE,
    start_url: '/',
    display: 'browser',
    background_color: '#0b0a12',
    theme_color: BRAND_THEME_COLOR,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function publishedClientScriptName(sourceFileName) {
  return sourceFileName.replace(/\.mjs$/, '.js');
}

export function rewriteClientImports(source) {
  return source.replace(/from '\.\/([\w-]+)\.mjs'/g, "from './$1.js'");
}

export function buildSitemapXml() {
  const urls = LOCALES.flatMap((locale) =>
    PAGES.map((page) => {
      const alternates = alternateLinks(page.id)
        .map((alternate) => `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}"/>`)
        .join('\n');
      return `  <url>\n    <loc>${canonicalUrl(locale, page.id)}</loc>\n${alternates}\n  </url>`;
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

export function buildRobotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('sitemap.xml')}\n`;
}
