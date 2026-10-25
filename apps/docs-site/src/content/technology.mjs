import { REPO_LICENSE_URL, REPO_NOTICES_URL } from '../site-config.mjs';
import { pick } from '../i18n.mjs';
import { icon } from '../icons.mjs';
import { pageHref } from '../routes.mjs';
import { calloutBox, escapeHtml, pageHero, sectionHeader } from '../render.mjs';
import {
  DISTRIBUTION_LABELS,
  MONOREPO_PROJECTS,
  TECH_CATEGORIES,
  TECH_ITEMS,
  itemsInCategory,
  localizedLicense,
} from '../tech-inventory.mjs';

const COPY = {
  es: {
    title: 'Tecnología',
    description: 'Todo lo que usa Video Maker, para qué lo usa y con qué licencia: Electron, React, Remotion, HyperFrames, FFmpeg, whisper.cpp, voces Piper, Claude Code, OpenRouter y el monorepo.',
    eyebrow: 'Inventario verificado',
    heading: 'La tecnología detrás de Video Maker',
    lede: 'Cada componente, para qué lo usa la herramienta y su licencia. La lista se contrasta en cada build de tests con el código del monorepo y con el mismo <code>THIRD_PARTY_NOTICES.md</code> que muestra la app.',
    stats: (counts) => [
      [String(counts.items), 'componentes'],
      [String(counts.local), 'corren en tu Mac'],
      [String(counts.projects), 'subproyectos'],
      ['MIT', 'licencia del código propio'],
    ],
    jump: 'Ir a',
    usedBy: 'Lo usa',
    license: 'Licencia',
    remotionTitle: 'Sobre la licencia de Remotion',
    remotionBody: (url) =>
      `<p>Remotion no es software libre: tiene su <a href="${url}">licencia propia</a>. Es gratis para personas y para empresas chicas bajo los umbrales que fija esa licencia; <strong>una empresa por encima de esos umbrales necesita comprar una licencia de empresa de Remotion</strong> para usar este proyecto, aunque el código de Video Maker sea MIT. HyperFrames, en cambio, es Apache-2.0.</p>`,
    monorepoTitle: 'El monorepo',
    monorepoLede: (counts) => `Un workspace Nx con pnpm: ${counts.apps} apps, ${counts.libs} libs y ${counts.tools} tools, todo en TypeScript estricto.`,
    licensesTitle: 'Licencias completas',
    licensesBody: (ctx) =>
      `<p>El código de Video Maker se publica con <a href="${REPO_LICENSE_URL}">licencia MIT</a>. Los textos y avisos de cada binario, modelo, voz, tipografía y tema musical están en <a href="${pageHref(ctx, 'licenses')}">Licencias</a> y en <a href="${REPO_NOTICES_URL}">THIRD_PARTY_NOTICES.md</a>.</p>`,
  },
  en: {
    title: 'Technology',
    description: 'Everything Video Maker uses, what for and under which license: Electron, React, Remotion, HyperFrames, FFmpeg, whisper.cpp, Piper voices, Claude Code, OpenRouter and the monorepo.',
    eyebrow: 'Verified inventory',
    heading: 'The technology behind Video Maker',
    lede: 'Every component, what the tool uses it for and its license. The list is checked in every test run against the monorepo code and against the same <code>THIRD_PARTY_NOTICES.md</code> the app shows.',
    stats: (counts) => [
      [String(counts.items), 'components'],
      [String(counts.local), 'run on your Mac'],
      [String(counts.projects), 'subprojects'],
      ['MIT', 'license of our own code'],
    ],
    jump: 'Jump to',
    usedBy: 'Used by',
    license: 'License',
    remotionTitle: 'About the Remotion license',
    remotionBody: (url) =>
      `<p>Remotion is not open source: it has its <a href="${url}">own license</a>. It is free for individuals and for small companies under the thresholds that license sets; <strong>a company above those thresholds must buy a Remotion company license</strong> to use this project, even though the Video Maker code is MIT. HyperFrames, on the other hand, is Apache-2.0.</p>`,
    monorepoTitle: 'The monorepo',
    monorepoLede: (counts) => `An Nx workspace with pnpm: ${counts.apps} apps, ${counts.libs} libs and ${counts.tools} tools, all in strict TypeScript.`,
    licensesTitle: 'Full licenses',
    licensesBody: (ctx) =>
      `<p>The Video Maker code is released under the <a href="${REPO_LICENSE_URL}">MIT license</a>. The texts and notices for every binary, model, voice, font and music track are on <a href="${pageHref(ctx, 'licenses')}">Licenses</a> and in <a href="${REPO_NOTICES_URL}">THIRD_PARTY_NOTICES.md</a>.</p>`,
  },
};

function inlineCode(text) {
  return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function techCard(item, locale, copy) {
  const version = item.version === undefined ? '' : `<span class="tech-card__version">${escapeHtml(item.version)}</span>`;
  const usedBy = item.usedBy.map((path) => `<li><code>${escapeHtml(path)}</code></li>`).join('');
  const licenseText = escapeHtml(localizedLicense(item, locale));
  const license = item.licenseUrl === undefined ? licenseText : `<a href="${item.licenseUrl}">${licenseText}</a>`;
  const warning = item.warning === undefined ? '' : `<p class="tech-card__warning">${icon('scale', 'icon icon--inline')}${escapeHtml(item.warning[locale])}</p>`;
  return `<li class="tech-card reveal" id="tech-${item.id}">
<div class="tech-card__head">
<h3 class="tech-card__name"><a href="${item.url}">${escapeHtml(item.name)}</a></h3>
${version}
</div>
<p class="tech-card__badges"><span class="badge badge--${item.distribution}">${escapeHtml(DISTRIBUTION_LABELS[item.distribution][locale])}</span><span class="badge badge--license"><span class="sr-only">${escapeHtml(copy.license)}: </span>${license}</span></p>
<p class="tech-card__what">${inlineCode(item.what[locale])}</p>
<p class="tech-card__why">${inlineCode(item.why[locale])}</p>
${warning}
<div class="tech-card__used"><span>${escapeHtml(copy.usedBy)}</span><ul>${usedBy}</ul></div>
</li>`;
}

function statsBand(copy) {
  const local = TECH_ITEMS.filter((item) => item.distribution === 'bundled' || item.distribution === 'first-run').length;
  const stats = copy
    .stats({ items: TECH_ITEMS.length, local, projects: MONOREPO_PROJECTS.length })
    .map(([value, label]) => `<li><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></li>`)
    .join('');
  return `<ul class="stats-band reveal">${stats}</ul>`;
}

function categoryJumpLinks(locale, copy) {
  const links = TECH_CATEGORIES.map((category) => `<li><a class="chip-link" href="#cat-${category.id}">${escapeHtml(category.title[locale])}</a></li>`).join('');
  return `<nav class="chip-nav" aria-label="${escapeHtml(copy.jump)}"><ul>${links}</ul></nav>`;
}

function categorySection(category, locale, copy) {
  const remotionNote = category.id === 'video'
    ? calloutBox('warning', `<p><strong>${escapeHtml(copy.remotionTitle)}</strong></p>${copy.remotionBody(TECH_ITEMS.find((item) => item.id === 'remotion').licenseUrl)}`)
    : '';
  const cards = itemsInCategory(category.id).map((item) => techCard(item, locale, copy)).join('');
  return `<section class="section tech-category" aria-labelledby="cat-${category.id}">
<div class="container">
${sectionHeader({ title: category.title[locale], lede: escapeHtml(category.lede[locale]), id: `cat-${category.id}` })}
${remotionNote}
<ul class="tech-grid">${cards}</ul>
</div>
</section>`;
}

function monorepoCounts() {
  const countGroup = (group) => MONOREPO_PROJECTS.filter((project) => project.path.startsWith(`${group}/`)).length;
  return { apps: countGroup('apps'), libs: countGroup('libs'), tools: countGroup('tools') };
}

function monorepoSection(locale, copy) {
  const groups = ['apps', 'libs', 'tools']
    .map((group) => {
      const items = MONOREPO_PROJECTS.filter((project) => project.path.startsWith(`${group}/`))
        .map((project) => `<li class="repo-tree__item reveal"><code>${escapeHtml(project.path)}</code><span>${escapeHtml(project.what[locale])}</span></li>`)
        .join('');
      return `<div class="repo-tree__group"><h3 class="repo-tree__title">${icon('code', 'icon icon--inline')}${group}/</h3><ul>${items}</ul></div>`;
    })
    .join('');
  return `<section class="section section--tinted" aria-labelledby="monorepo-title">
<div class="container">
${sectionHeader({ title: copy.monorepoTitle, lede: escapeHtml(copy.monorepoLede(monorepoCounts())), id: 'monorepo-title' })}
<div class="repo-tree">${groups}</div>
</div>
</section>`;
}

export function renderPage(ctx) {
  const copy = pick(ctx.locale, COPY);
  const bodyHtml = `
${pageHero({ eyebrow: copy.eyebrow, title: copy.heading, lede: copy.lede })}
<section class="section section--flush-top">
<div class="container">
${statsBand(copy)}
${categoryJumpLinks(ctx.locale, copy)}
</div>
</section>
${TECH_CATEGORIES.map((category) => categorySection(category, ctx.locale, copy)).join('\n')}
${monorepoSection(ctx.locale, copy)}
<section class="section" aria-labelledby="licenses-title">
<div class="container container--narrow">
${sectionHeader({ title: copy.licensesTitle, id: 'licenses-title' })}
${copy.licensesBody(ctx)}
</div>
</section>`;
  return { title: copy.title, description: copy.description, bodyHtml };
}
