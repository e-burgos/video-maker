import { LOCALES, PAGES } from './site-config.mjs';
import { absoluteUrl, alternateLinks, canonicalUrl } from './routes.mjs';

export const CLIENT_SCRIPT_FILES = ['site.mjs', 'site-logic.mjs'];

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
