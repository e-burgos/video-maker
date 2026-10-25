import { COPYRIGHT_HOLDER, REPO_ISSUES_URL, REPO_LICENSE_URL, REPO_URL } from '../site-config.mjs';
import { pick } from '../i18n.mjs';
import { icon } from '../icons.mjs';
import { pageHref } from '../routes.mjs';
import { calloutBox, escapeHtml, githubButton, pageHero, sectionHeader, stepList } from '../render.mjs';

const SETUP_COMMANDS = `git clone ${REPO_URL}.git
cd video-maker
pnpm install
cp .env.example .env
brew install ffmpeg whisper-cpp
pnpm fetch:dev-voices
pnpm studio`;

const QUALITY_COMMANDS = `pnpm exec nx run-many -t lint test build
pnpm sdd:validate`;

const COPY = {
  es: {
    title: 'Código abierto',
    description: 'El código de Video Maker es abierto y con licencia MIT: cómo correrlo, cómo contribuir y qué licencias aplican.',
    eyebrow: 'MIT · GitHub',
    heading: 'Video Maker es código abierto',
    lede: 'Todo el estudio — la app de escritorio, el motor, el productor y esta web — vive en un repositorio público. Leelo, correlo en tu máquina y proponé mejoras.',
    repoTitle: 'El repositorio',
    repoText:
      'Un monorepo Nx con pnpm: las apps viven en <code>apps/</code>, las bibliotecas en <code>libs/</code> y las herramientas de línea de comandos en <code>tools/</code>. El inventario completo, con qué hace cada pieza, está en Tecnología.',
    techLink: 'Ver la tecnología',
    runTitle: 'Correrlo en tu máquina',
    runText:
      'Necesitás Node 22 o superior y pnpm 10 (el único gestor de paquetes del repo). En <code>.env</code> van las rutas absolutas de ffmpeg, ffprobe, whisper-cli y el modelo de whisper; el propio <code>.env.example</code> explica cada una.',
    runNote: '<code>pnpm studio</code> levanta el servicio local y el Web Studio juntos; la app de escritorio se arma con <code>pnpm desktop:dist</code> (macOS Apple Silicon).',
    contributeTitle: 'Cómo contribuir',
    steps: [
      { title: 'Abrí un issue', bodyHtml: `<p>Contá el problema o la idea en <a href="${REPO_ISSUES_URL}">Issues</a> antes de escribir código: así acordamos el alcance.</p>` },
      {
        title: 'Seguí el flujo SDD',
        bodyHtml:
          '<p>El repo usa Spec-Driven Development: cada funcionalidad nueva nace de una spec en <code>sdd/specs/</code> y cada arreglo se registra en <code>sdd/fixes.json</code>. El punto de entrada para personas y agentes es <code>sdd/context/context_prompt.md</code>.</p>',
      },
      {
        title: 'Código que se explica solo',
        bodyHtml:
          '<p>Sin comentarios narrativos: nombres declarativos y funciones cortas. La documentación vive en los documentos SDD, no en el código.</p>',
      },
      { title: 'Todo en verde antes del PR', bodyHtml: `<pre><code>${escapeHtml(QUALITY_COMMANDS)}</code></pre><p>El mismo chequeo de registros SDD corre en CI.</p>` },
      { title: 'Abrí el pull request', bodyHtml: '<p>Desde una rama propia, con qué cambia y cómo lo probaste.</p>' },
    ],
    licenseTitle: 'Licencia',
    licenseText: `<p>El código de Video Maker se publica con la <a href="${REPO_LICENSE_URL}">licencia MIT</a> — © ${COPYRIGHT_HOLDER}. Podés usarlo, copiarlo, modificarlo y redistribuirlo conservando el aviso de copyright.</p>`,
    licenseThirdParty: (ctx) =>
      `<p>Los binarios, modelos, voces, tipografías y temas musicales de terceros mantienen sus propias licencias (GPL, LGPL, Apache, CC BY, CC BY-SA, OFL…): están listados en <a href="${pageHref(ctx, 'licenses')}">Licencias</a> y explicados en <a href="${pageHref(ctx, 'technology')}">Tecnología</a>.</p>`,
    remotionWarning: (ctx) =>
      `<p><strong>Remotion tiene condiciones propias para empresas.</strong> Que el código de Video Maker sea MIT no cambia la licencia de Remotion: una empresa por encima de sus umbrales necesita una licencia de empresa de Remotion. Detalle en <a href="${pageHref(ctx, 'technology')}#tech-remotion">Tecnología</a>.</p>`,
  },
  en: {
    title: 'Open source',
    description: 'The Video Maker code is open and MIT-licensed: how to run it, how to contribute and which licenses apply.',
    eyebrow: 'MIT · GitHub',
    heading: 'Video Maker is open source',
    lede: 'The whole studio — the desktop app, the engine, the producer and this website — lives in a public repository. Read it, run it on your machine and propose improvements.',
    repoTitle: 'The repository',
    repoText:
      'An Nx monorepo with pnpm: apps live in <code>apps/</code>, libraries in <code>libs/</code> and command-line tools in <code>tools/</code>. The full inventory, with what each piece does, is on Technology.',
    techLink: 'See the technology',
    runTitle: 'Run it on your machine',
    runText:
      'You need Node 22 or later and pnpm 10 (the only package manager in the repo). <code>.env</code> holds the absolute paths to ffmpeg, ffprobe, whisper-cli and the whisper model; <code>.env.example</code> explains each one.',
    runNote: '<code>pnpm studio</code> starts the local service and the Web Studio together; the desktop app is built with <code>pnpm desktop:dist</code> (macOS Apple Silicon).',
    contributeTitle: 'How to contribute',
    steps: [
      { title: 'Open an issue', bodyHtml: `<p>Describe the problem or the idea in <a href="${REPO_ISSUES_URL}">Issues</a> before writing code, so we can agree on the scope.</p>` },
      {
        title: 'Follow the SDD flow',
        bodyHtml:
          '<p>The repo uses Spec-Driven Development: every new feature starts from a spec in <code>sdd/specs/</code> and every fix is recorded in <code>sdd/fixes.json</code>. The entry point for people and agents is <code>sdd/context/context_prompt.md</code> (written in Spanish).</p>',
      },
      {
        title: 'Self-explanatory code',
        bodyHtml: '<p>No narrative comments: declarative names and short functions. Documentation lives in the SDD documents, not in the code.</p>',
      },
      { title: 'Everything green before the PR', bodyHtml: `<pre><code>${escapeHtml(QUALITY_COMMANDS)}</code></pre><p>The same SDD registry check runs in CI.</p>` },
      { title: 'Open the pull request', bodyHtml: '<p>From your own branch, explaining what changes and how you tested it.</p>' },
    ],
    licenseTitle: 'License',
    licenseText: `<p>The Video Maker code is released under the <a href="${REPO_LICENSE_URL}">MIT license</a> — © ${COPYRIGHT_HOLDER}. You may use, copy, modify and redistribute it as long as you keep the copyright notice.</p>`,
    licenseThirdParty: (ctx) =>
      `<p>Third-party binaries, models, voices, fonts and music keep their own licenses (GPL, LGPL, Apache, CC BY, CC BY-SA, OFL…): they are listed on <a href="${pageHref(ctx, 'licenses')}">Licenses</a> and explained on <a href="${pageHref(ctx, 'technology')}">Technology</a>.</p>`,
    remotionWarning: (ctx) =>
      `<p><strong>Remotion has its own terms for companies.</strong> The MIT license of the Video Maker code does not change Remotion’s license: a company above its thresholds needs a Remotion company license. Details on <a href="${pageHref(ctx, 'technology')}#tech-remotion">Technology</a>.</p>`,
  },
};

export function renderPage(ctx) {
  const copy = pick(ctx.locale, COPY);
  const bodyHtml = `
${pageHero({ eyebrow: copy.eyebrow, title: copy.heading, lede: escapeHtml(copy.lede) })}
<section class="section section--flush-top">
<div class="container">
<div class="open-band reveal">
<div class="open-band__copy">
<h2 class="section-title">${escapeHtml(copy.repoTitle)}</h2>
<p>${copy.repoText}</p>
<div class="open-band__actions">
${githubButton(ctx, 'button button--primary')}
<a class="button button--ghost" href="${pageHref(ctx, 'technology')}">${escapeHtml(copy.techLink)} ${icon('arrowRight')}</a>
</div>
</div>
<p class="open-band__url"><code>${escapeHtml(REPO_URL.replace('https://', ''))}</code></p>
</div>
</div>
</section>
<section class="section" aria-labelledby="run-title">
<div class="container container--narrow prose">
${sectionHeader({ title: copy.runTitle, id: 'run-title' })}
<p>${copy.runText}</p>
<pre><code>${escapeHtml(SETUP_COMMANDS)}</code></pre>
<p>${copy.runNote}</p>
</div>
</section>
<section class="section section--tinted" aria-labelledby="contribute-title">
<div class="container container--narrow prose">
${sectionHeader({ title: copy.contributeTitle, id: 'contribute-title' })}
${stepList(copy.steps)}
</div>
</section>
<section class="section" aria-labelledby="license-title">
<div class="container container--narrow prose">
${sectionHeader({ title: copy.licenseTitle, id: 'license-title' })}
${copy.licenseText}
${copy.licenseThirdParty(ctx)}
${calloutBox('warning', copy.remotionWarning(ctx))}
</div>
</section>`;
  return { title: copy.title, description: copy.description, bodyHtml };
}
