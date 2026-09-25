import { APP_DISPLAY_NAME, NAV_PAGES } from './site-config.mjs';

export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function relativePrefix(depth) {
  return depth === 0 ? './' : '../';
}

export function assetHref(depth, path) {
  return `${relativePrefix(depth)}${path}`;
}

export function pageHref(depth, targetSlug) {
  return `${relativePrefix(depth)}${targetSlug === '' ? '' : `${targetSlug}/`}`;
}

function navMarkup(depth, activeSlug) {
  const items = NAV_PAGES.map((page) => {
    const isActive = page.slug === activeSlug;
    const href = pageHref(depth, page.slug);
    const ariaCurrent = isActive ? ' aria-current="page"' : '';
    const activeClass = isActive ? ' class="site-nav__link site-nav__link--active"' : ' class="site-nav__link"';
    return `<li><a href="${href}"${activeClass}${ariaCurrent}>${escapeHtml(page.navLabel)}</a></li>`;
  }).join('');
  return `<nav class="site-nav" aria-label="Principal"><ul class="site-nav__list">${items}</ul></nav>`;
}

export function pageLayout({ depth, activeSlug, title, description, bodyHtml }) {
  const fullTitle = activeSlug === '' ? APP_DISPLAY_NAME : `${title} · ${APP_DISPLAY_NAME}`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="stylesheet" href="${assetHref(depth, 'assets/style.css')}" />
</head>
<body>
<a class="skip-link" href="#contenido">Saltar al contenido</a>
<header class="site-header">
<div class="site-header__bar">
<a class="site-header__brand" href="${pageHref(depth, '')}">${escapeHtml(APP_DISPLAY_NAME)}</a>
${navMarkup(depth, activeSlug)}
</div>
</header>
<main id="contenido" class="site-main">
${bodyHtml}
</main>
<footer class="site-footer">
<p>Hecho por un amigo, para amigos. Corre entero en tu Mac.</p>
<p><a href="${pageHref(depth, 'licencias')}">Licencias de terceros</a></p>
</footer>
</body>
</html>
`;
}

export function downloadButton(href, label) {
  return `<a class="download-button" href="${href}">${escapeHtml(label)}</a>`;
}

export function screenshotFigure(depth, fileName, altText) {
  return `<figure class="screenshot">
<img src="${assetHref(depth, `assets/screenshots/${fileName}`)}" alt="${escapeHtml(altText)}" loading="lazy" width="1440" height="900" />
</figure>`;
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
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="table-wrap"><table class="info-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

export function calloutBox(kind, bodyHtml) {
  return `<div class="callout callout--${kind}">${bodyHtml}</div>`;
}
