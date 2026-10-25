import { DEFAULT_LOCALE, LOCALES, LOCALE_PATH_PREFIX, PAGES, SITE_URL } from './site-config.mjs';

export function pageById(pageId) {
  const page = PAGES.find((candidate) => candidate.id === pageId);
  if (page === undefined) {
    throw new Error(`unknown page id "${pageId}"`);
  }
  return page;
}

export function assertLocale(locale) {
  if (!LOCALES.includes(locale)) {
    throw new Error(`unknown locale "${locale}"`);
  }
  return locale;
}

export function pagePath(locale, pageId) {
  const slug = pageById(pageId).slugs[assertLocale(locale)];
  return `${LOCALE_PATH_PREFIX[locale]}${slug === '' ? '' : `${slug}/`}`;
}

export function depthOfPath(path) {
  return path.split('/').filter((segment) => segment !== '').length;
}

export function relativePrefix(depth) {
  return depth === 0 ? './' : '../'.repeat(depth);
}

export function createPageContext(locale, pageId) {
  const path = pagePath(locale, pageId);
  return { locale, pageId, path, depth: depthOfPath(path) };
}

export function pageHref(ctx, targetPageId, targetLocale = ctx.locale) {
  return `${relativePrefix(ctx.depth)}${pagePath(targetLocale, targetPageId)}`;
}

export function assetHref(ctx, assetPath) {
  return `${relativePrefix(ctx.depth)}${assetPath}`;
}

export function absoluteUrl(path) {
  return `${SITE_URL}/${path}`;
}

export function canonicalUrl(locale, pageId) {
  return absoluteUrl(pagePath(locale, pageId));
}

export function alternateLinks(pageId) {
  const perLocale = LOCALES.map((locale) => ({ hreflang: locale, href: canonicalUrl(locale, pageId) }));
  return [...perLocale, { hreflang: 'x-default', href: canonicalUrl(DEFAULT_LOCALE, pageId) }];
}

export function otherLocale(locale) {
  return LOCALES.find((candidate) => candidate !== locale);
}

export function allPageContexts() {
  return LOCALES.flatMap((locale) => PAGES.map((page) => createPageContext(locale, page.id)));
}

export function guidePageIds() {
  return PAGES.filter((page) => page.group === 'guide').map((page) => page.id);
}

export function mainPageIds() {
  return PAGES.filter((page) => page.group === 'main').map((page) => page.id);
}
