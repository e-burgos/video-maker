import {
  APP_DISPLAY_NAME,
  COPYRIGHT_HOLDER,
  COPYRIGHT_YEAR,
  DOWNLOAD_URL,
  OG_IMAGE_PATH,
  REPO_ISSUES_URL,
  REPO_LICENSE_URL,
  REPO_URL,
} from './site-config.mjs';
import { BRAND_MARK_SVG, icon } from './icons.mjs';
import { t } from './i18n.mjs';
import {
  absoluteUrl,
  alternateLinks,
  assetHref,
  canonicalUrl,
  guidePageIds,
  mainPageIds,
  otherLocale,
  pageById,
  pageHref,
} from './routes.mjs';
import {
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  SUPPORTED_THEMES,
  THEME_STORAGE_KEY,
  localeRedirectTarget,
  parseStoredLocale,
  parseStoredTheme,
  readStorage,
  resolveEffectiveTheme,
} from './client/site-logic.mjs';

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SCREENSHOT_DIMENSIONS = {
  'gatekeeper-not-opened.png': { width: 298, height: 320 },
};

const DEFAULT_SCREENSHOT_DIMENSIONS = { width: 1440, height: 900 };

export function screenshotDimensions(fileName) {
  return SCREENSHOT_DIMENSIONS[fileName] ?? DEFAULT_SCREENSHOT_DIMENSIONS;
}

export function headBootstrapScript() {
  const helpers = [parseStoredTheme, parseStoredLocale, resolveEffectiveTheme, localeRedirectTarget, readStorage]
    .map((helper) => helper.toString())
    .join('\n');
  return `(function(){
var SUPPORTED_THEMES=${JSON.stringify(SUPPORTED_THEMES)};
var SUPPORTED_LOCALES=${JSON.stringify(SUPPORTED_LOCALES)};
${helpers}
var storage=null;try{storage=window.localStorage}catch(error){}
var root=document.documentElement;
var prefersDark=!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
root.setAttribute('data-theme',resolveEffectiveTheme(readStorage(storage,${JSON.stringify(THEME_STORAGE_KEY)}),prefersDark));
root.classList.add('js');
var alternates=Array.prototype.map.call(document.querySelectorAll('link[rel="alternate"][hreflang]'),function(link){return{hreflang:link.getAttribute('hreflang'),href:window.location.origin+new URL(link.href).pathname}});
var target=localeRedirectTarget(readStorage(storage,${JSON.stringify(LOCALE_STORAGE_KEY)}),root.lang,alternates);
if(target&&target!==window.location.origin+window.location.pathname){window.location.replace(target+window.location.hash)}
})();`;
}

function navLabel(locale, pageId) {
  return t(locale, `nav.${pageId}`);
}

function isGuidePage(pageId) {
  return pageById(pageId).group === 'guide';
}

function mainNavMarkup(ctx) {
  const items = mainPageIds()
    .filter((pageId) => pageId !== 'home')
    .flatMap((pageId) => (pageId === 'open-source' ? ['installation', pageId] : [pageId]))
    .map((pageId) => {
      const isGuideEntry = pageId === 'installation';
      const isActive = isGuideEntry ? isGuidePage(ctx.pageId) : pageId === ctx.pageId;
      const label = isGuideEntry ? t(ctx.locale, 'nav.guide') : navLabel(ctx.locale, pageId);
      const current = isActive ? ' aria-current="page"' : '';
      const activeClass = isActive ? ' site-nav__link--active' : '';
      return `<li><a class="site-nav__link${activeClass}" href="${pageHref(ctx, pageId)}"${current}>${escapeHtml(label)}</a></li>`;
    })
    .join('');
  return `<nav id="site-nav" class="site-nav" aria-label="${escapeHtml(t(ctx.locale, 'nav.mainLabel'))}"><ul class="site-nav__list">${items}</ul></nav>`;
}

function localeSwitchLink(ctx, className) {
  const target = otherLocale(ctx.locale);
  return `<a class="${className}" href="${pageHref(ctx, ctx.pageId, target)}" hreflang="${target}" lang="${target}" data-locale-switch="${target}" title="${escapeHtml(t(ctx.locale, 'lang.switchTo'))}">${icon('globe')}<span>${escapeHtml(t(ctx.locale, 'lang.switchShort'))}</span><span class="sr-only"> — ${escapeHtml(t(ctx.locale, 'lang.switchTo'))}</span></a>`;
}

function themeToggleButton(ctx) {
  return `<button type="button" class="icon-button theme-toggle" data-theme-toggle hidden aria-label="${escapeHtml(t(ctx.locale, 'header.themeToggle'))}">${icon('sun', 'icon icon--sun')}${icon('moon', 'icon icon--moon')}</button>`;
}

export function githubLink(ctx, className = 'icon-button') {
  return `<a class="${className}" href="${REPO_URL}" rel="noopener">${icon('github')}<span class="sr-only">${escapeHtml(t(ctx.locale, 'header.github'))}</span></a>`;
}

function headerMarkup(ctx) {
  return `<header class="site-header" data-site-header>
<div class="site-header__bar">
<a class="brand" href="${pageHref(ctx, 'home')}">${BRAND_MARK_SVG}<span class="brand__name">${escapeHtml(APP_DISPLAY_NAME)}</span></a>
<button type="button" class="icon-button menu-toggle" data-menu-toggle aria-controls="site-nav" aria-expanded="false" hidden>${icon('menu')}<span class="sr-only">${escapeHtml(t(ctx.locale, 'nav.menu'))}</span></button>
${mainNavMarkup(ctx)}
<div class="site-header__actions">
${localeSwitchLink(ctx, 'icon-button locale-switch')}
${themeToggleButton(ctx)}
${githubLink(ctx)}
<a class="button button--primary button--small header-download" href="${DOWNLOAD_URL}">${icon('download')}<span>${escapeHtml(t(ctx.locale, 'header.download'))}</span></a>
</div>
</div>
</header>`;
}

function guideNavMarkup(ctx) {
  const items = guidePageIds()
    .map((pageId) => {
      const isActive = pageId === ctx.pageId;
      const current = isActive ? ' aria-current="page"' : '';
      const activeClass = isActive ? ' guide-nav__link--active' : '';
      return `<li><a class="guide-nav__link${activeClass}" href="${pageHref(ctx, pageId)}"${current}>${escapeHtml(navLabel(ctx.locale, pageId))}</a></li>`;
    })
    .join('');
  return `<nav class="guide-nav" aria-label="${escapeHtml(t(ctx.locale, 'nav.guideLabel'))}"><p class="guide-nav__title">${escapeHtml(t(ctx.locale, 'guide.onThisSection'))}</p><ul class="guide-nav__list">${items}</ul></nav>`;
}

function footerColumn(title, links) {
  const items = links.map((link) => `<li><a href="${link.href}"${link.extra ?? ''}>${escapeHtml(link.label)}</a></li>`).join('');
  return `<div class="footer-col"><h2 class="footer-col__title">${escapeHtml(title)}</h2><ul>${items}</ul></div>`;
}

function footerMarkup(ctx) {
  const { locale } = ctx;
  const product = footerColumn(t(locale, 'footer.product'), [
    { href: pageHref(ctx, 'home'), label: navLabel(locale, 'home') },
    { href: pageHref(ctx, 'how-it-works'), label: navLabel(locale, 'how-it-works') },
    { href: pageHref(ctx, 'technology'), label: navLabel(locale, 'technology') },
    { href: DOWNLOAD_URL, label: t(locale, 'footer.download') },
  ]);
  const guide = footerColumn(
    t(locale, 'footer.guide'),
    guidePageIds().map((pageId) => ({ href: pageHref(ctx, pageId), label: navLabel(locale, pageId) })),
  );
  const openSource = footerColumn(t(locale, 'footer.openSource'), [
    { href: pageHref(ctx, 'open-source'), label: navLabel(locale, 'open-source') },
    { href: REPO_URL, label: t(locale, 'footer.repo'), extra: ' rel="noopener"' },
    { href: REPO_ISSUES_URL, label: t(locale, 'footer.issues'), extra: ' rel="noopener"' },
    { href: REPO_LICENSE_URL, label: t(locale, 'footer.license'), extra: ' rel="noopener"' },
    { href: pageHref(ctx, 'licenses'), label: t(locale, 'footer.notices') },
  ]);
  return `<footer class="site-footer">
<div class="site-footer__inner">
<div class="footer-brand">
<a class="brand" href="${pageHref(ctx, 'home')}">${BRAND_MARK_SVG}<span class="brand__name">${escapeHtml(APP_DISPLAY_NAME)}</span></a>
<p>${escapeHtml(t(locale, 'brand.tagline'))}</p>
<div class="footer-brand__actions">${githubLink(ctx, 'button button--ghost button--small')}${localeSwitchLink(ctx, 'button button--ghost button--small')}</div>
</div>
${product}
${guide}
${openSource}
</div>
<p class="site-footer__legal">© ${COPYRIGHT_YEAR} ${escapeHtml(COPYRIGHT_HOLDER)} · ${escapeHtml(t(locale, 'footer.rights'))} ${escapeHtml(t(locale, 'footer.madeIn'))}</p>
</footer>`;
}

function headMarkup(ctx, fullTitle, description) {
  const alternates = alternateLinks(ctx.pageId)
    .map((alternate) => `<link rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}" />`)
    .join('\n');
  const ogImage = absoluteUrl(OG_IMAGE_PATH);
  const ogAlternateLocale = t(otherLocale(ctx.locale), 'meta.ogLocale');
  return `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" content="#f6f4fb" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0b0a12" media="(prefers-color-scheme: dark)" />
<link rel="canonical" href="${canonicalUrl(ctx.locale, ctx.pageId)}" />
${alternates}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${escapeHtml(APP_DISPLAY_NAME)}" />
<meta property="og:title" content="${escapeHtml(fullTitle)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${canonicalUrl(ctx.locale, ctx.pageId)}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:width" content="1440" />
<meta property="og:image:height" content="900" />
<meta property="og:locale" content="${t(ctx.locale, 'meta.ogLocale')}" />
<meta property="og:locale:alternate" content="${ogAlternateLocale}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="${assetHref(ctx, 'favicon.svg')}" type="image/svg+xml" />
<link rel="preload" href="${assetHref(ctx, 'assets/fonts/outfit-700.woff2')}" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="${assetHref(ctx, 'assets/style.css')}" />
<script>${headBootstrapScript()}</script>
<script type="module" src="${assetHref(ctx, 'assets/js/site.js')}"></script>`;
}

export function pageLayout({ ctx, title, description, bodyHtml }) {
  const fullTitle = ctx.pageId === 'home' ? `${APP_DISPLAY_NAME} — ${t(ctx.locale, 'brand.tagline')}` : `${title} · ${APP_DISPLAY_NAME}`;
  const main = isGuidePage(ctx.pageId)
    ? `<div class="guide-layout">${guideNavMarkup(ctx)}<article class="guide-article prose">${bodyHtml}</article></div>`
    : bodyHtml;
  return `<!doctype html>
<html lang="${ctx.locale}" data-page="${ctx.pageId}">
<head>
${headMarkup(ctx, fullTitle, description)}
</head>
<body>
<a class="skip-link" href="#contenido">${escapeHtml(t(ctx.locale, 'skip.toContent'))}</a>
${headerMarkup(ctx)}
<main id="contenido" class="site-main${isGuidePage(ctx.pageId) ? ' site-main--guide' : ''}">
${main}
</main>
${footerMarkup(ctx)}
</body>
</html>
`;
}

export function downloadButton(ctx, className = 'button button--primary button--large') {
  return `<a class="${className}" href="${DOWNLOAD_URL}">${icon('download')}<span>${escapeHtml(t(ctx.locale, 'download.cta'))}</span></a>`;
}

export function githubButton(ctx, className = 'button button--secondary button--large') {
  return `<a class="${className}" href="${REPO_URL}" rel="noopener">${icon('github')}<span>${escapeHtml(t(ctx.locale, 'header.github'))}</span></a>`;
}

export function screenshotFigure(ctx, fileName, altText, { caption = null, eager = false, className = 'screenshot' } = {}) {
  const { width, height } = screenshotDimensions(fileName);
  const loading = eager ? 'eager' : 'lazy';
  const figcaption = caption === null ? '' : `<figcaption>${escapeHtml(caption)}</figcaption>`;
  return `<figure class="${className}">
<img src="${assetHref(ctx, `assets/screenshots/${fileName}`)}" alt="${escapeHtml(altText)}" loading="${loading}" decoding="async" width="${width}" height="${height}" />
${figcaption}</figure>`;
}

export function stepList(steps) {
  const items = steps
    .map(
      (step, index) => `<li class="step">
<span class="step__number" aria-hidden="true">${index + 1}</span>
<div class="step__body">
<h3 class="step__title">${escapeHtml(step.title)}</h3>
${step.bodyHtml}
</div>
</li>`,
    )
    .join('');
  return `<ol class="step-list">${items}</ol>`;
}

export function faqItem(question, answerHtml) {
  return `<details class="faq-item">
<summary class="faq-item__question">${escapeHtml(question)}</summary>
<div class="faq-item__answer">${answerHtml}</div>
</details>`;
}

export function infoTable(headers, rows) {
  const head = `<tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr>`;
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table class="info-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

export function calloutBox(kind, bodyHtml) {
  return `<div class="callout callout--${kind}">${bodyHtml}</div>`;
}

export function sectionHeader({ eyebrow = null, title, lede = null, headingLevel = 2, id = null }) {
  const idAttribute = id === null ? '' : ` id="${id}"`;
  const eyebrowHtml = eyebrow === null ? '' : `<p class="eyebrow">${escapeHtml(eyebrow)}</p>`;
  const ledeHtml = lede === null ? '' : `<p class="section-lede">${lede}</p>`;
  return `<div class="section-header reveal">${eyebrowHtml}<h${headingLevel} class="section-title"${idAttribute}>${escapeHtml(title)}</h${headingLevel}>${ledeHtml}</div>`;
}

export function pageHero({ eyebrow, title, lede }) {
  return `<section class="page-hero"><div class="container">${sectionHeader({ eyebrow, title, lede, headingLevel: 1 })}</div></section>`;
}
