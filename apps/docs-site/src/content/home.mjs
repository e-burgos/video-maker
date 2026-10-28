import { APPROX_DMG_SIZE_LABEL, APP_DISPLAY_NAME, REPO_URL, TUTORIAL_MUSIC_SOURCE_URL } from '../site-config.mjs';
import { pick, t } from '../i18n.mjs';
import { icon } from '../icons.mjs';
import { assetHref, pageHref } from '../routes.mjs';
import { downloadButton, escapeHtml, githubButton, infoTable, screenshotFigure, sectionHeader } from '../render.mjs';
import { featureGrid, pipelineDiagram } from '../components.mjs';
import { pipelineStages } from './journeys.mjs';

const TUTORIAL_VIDEO_PATH = '/tutoriales/Tutorial-Video-Maker.mp4';

const COPY = {
  es: {
    title: 'Inicio',
    description:
      'Video Maker: un estudio de video con un productor de IA que corre en tu Mac. Motion graphics o material crudo, voz en español, música y render local. Código abierto.',
    eyebrow: 'Código abierto · macOS Apple Silicon',
    titleLead: 'Del guion al video,',
    titleAccent: 'en tu Mac.',
    lede:
      'Un productor de IA que arma el video con vos. Elegís el camino — <strong>motion graphics</strong> animados con tu marca o <strong>material crudo</strong> montado, subtitulado y con locución — y todo el trabajo pesado corre en tu máquina.',
    meta: 'macOS 13+ · gratis · licencia MIT',
    heroAlt: 'Un video de motion graphics terminado dentro de Video Maker',
    tracks: ['Voz', 'Escenas', 'Música', 'Texto'],
    chips: ['Voz es_AR · local', '−14 LUFS', '16:9 · 9:16', 'Render en tu Mac'],
    tutorialEyebrow: 'Mirá cómo funciona',
    tutorialTitle: 'De la marca al video, en poco más de dos minutos',
    tutorialLede: 'Un recorrido real por el estudio: se crea una marca, se adjuntan las fotos, el productor arma el video y se publica. Las esperas del productor van aceleradas.',
    tutorialLabel: 'Video tutorial de Video Maker de punta a punta',
    tutorialNote: 'Voz: Malena · Música:',
    pathsEyebrow: 'Dos caminos',
    pathsTitle: 'Elegí cómo nace tu video',
    pathsLede: 'Los dos terminan en un MP4 listo para publicar, con voz, música y subtítulos.',
    motionTitle: 'Motion graphics',
    motionText: 'Escribís el guion y el estudio diseña escenas animadas con tu marca: títulos cinéticos, equipos con su pantalla, celulares, tableros y fotos.',
    motionPoints: ['Storyboard propuesto por la IA', 'Cortes al golpe de la música', 'Ajustes conversando con el productor'],
    motionAlt: 'Brief de un video de motion graphics con marca, formato, música y guion',
    footageTitle: 'Material crudo',
    footageText: 'Traés grabaciones de pantalla, cámara o fotos y el productor monta: corta silencios, ubica el B-roll, subtitula y pone la locución.',
    footagePoints: ['Rol propuesto para cada archivo', 'Recetas Tutorial, vertical y Publicidad', 'B-roll libre de Wikimedia Commons y NASA'],
    footageAlt: 'Conversación con el productor y la vista previa de un render terminado',
    pathsCta: 'Ver el recorrido paso a paso',
    pipelineEyebrow: 'El pipeline',
    pipelineTitle: 'Cinco etapas, un solo estudio',
    pipelineLabel: 'Etapas del pipeline de Video Maker',
    pipelineCta: 'Cómo funciona cada etapa',
    featuresEyebrow: 'Por qué Video Maker',
    featuresTitle: 'Hecho para producir, no para pelear con el editor',
    features: [
      { icon: 'lock', title: 'Local primero', textHtml: 'Transcripción, voz, mezcla y render corren en tu Mac. Sólo el texto de la conversación sale hacia la IA que elijas.' },
      { icon: 'chat', title: 'Un productor que conversa', textHtml: 'Claude Code con tu suscripción u OpenRouter con tu key. Propone, explica y rehace sólo lo que pediste cambiar.' },
      { icon: 'voice', title: 'Voz en español', textHtml: 'Voces Piper es_AR, es_ES y es_MX sintetizadas en tu equipo, con la mejor toma por frase.' },
      { icon: 'captions', title: 'Subtítulos cinéticos', textHtml: 'De una a tres palabras por pantalla, dentro de las zonas seguras de Reels, TikTok y YouTube.' },
      { icon: 'brand', title: 'Tu marca en cada video', textHtml: 'Colores, logo, tipografías, voz y música en un kit editable con vista previa en vivo.' },
      { icon: 'upload', title: 'Publicá sin salir', textHtml: 'Subí a tu canal de YouTube con título, descripción y créditos propuestos por el productor.' },
    ],
    galleryEyebrow: 'Así se ve',
    galleryTitle: 'Capturas reales de la app',
    gallery: [
      ['home-projects.png', 'Tus videos: lista de proyectos con miniaturas reales y su estado'],
      ['motion-video.png', 'Un video de motion graphics terminado, con el crédito de la música para la descripción'],
      ['workspace-preview.png', 'Conversación con el productor y la vista previa de un render terminado'],
      ['proposal-card.png', 'Al soltar un archivo, el productor propone un rol para confirmar o descartar'],
    ],
    requirementsEyebrow: 'Antes de bajarla',
    requirementsTitle: 'Qué necesitás',
    requirementsHeaders: ['Requisito', 'Detalle'],
    requirements: (ctx) => [
      ['Mac', 'Apple Silicon (M1 o superior). No hay versión para Intel ni para Windows/Linux.'],
      ['macOS', '13 Ventura o más nuevo.'],
      ['Espacio en disco', 'unos 2 GB libres (la app instalada, el instalador y las descargas del primer arranque).'],
      ['Un motor de IA', `Claude Code con tu propia suscripción, <strong>o</strong> una API key de OpenRouter con crédito — se explica en <a href="${pageHref(ctx, 'connect-ai')}">Conectar la IA</a>.`],
    ],
    requirementsNote: (ctx) =>
      `¿Primera vez? Seguí la <a href="${pageHref(ctx, 'installation')}">instalación</a>: hay un paso extra porque la app no tiene firma de Apple Developer.`,
    openEyebrow: 'Código abierto',
    openTitle: 'Leé el código, proponé cambios, armá tu versión',
    openText:
      'Video Maker es un monorepo Nx en TypeScript con licencia MIT. Cada funcionalidad nace de una spec y cada arreglo queda registrado: podés seguir por qué está hecho como está.',
    openTech: 'Ver toda la tecnología',
    openContribute: 'Cómo contribuir',
    finalTitle: 'Tu próximo video empieza con una idea',
    finalText: 'Bajá la app, conectá la IA y contale al productor qué querés contar.',
  },
  en: {
    title: 'Home',
    description:
      'Video Maker: a video studio with an AI producer that runs on your Mac. Motion graphics or raw footage, Spanish voices, music and local rendering. Open source.',
    eyebrow: 'Open source · macOS Apple Silicon',
    titleLead: 'From script to video,',
    titleAccent: 'on your Mac.',
    lede:
      'An AI producer that builds the video with you. Pick the path — <strong>motion graphics</strong> animated with your brand or <strong>raw footage</strong> edited, captioned and voiced — and all the heavy lifting runs on your machine.',
    meta: 'macOS 13+ · free · MIT license',
    heroAlt: 'A finished motion graphics video inside Video Maker',
    tracks: ['Voice', 'Scenes', 'Music', 'Text'],
    chips: ['es_AR voice · local', '−14 LUFS', '16:9 · 9:16', 'Rendered on your Mac'],
    tutorialEyebrow: 'See how it works',
    tutorialTitle: 'From brand to finished video, in a little over two minutes',
    tutorialLede: 'A real walkthrough of the studio: create a brand, attach the photos, let the producer build the video and publish it. The long waits for the producer are sped up; narrated and captioned in Spanish.',
    tutorialLabel: 'Video Maker end-to-end tutorial video',
    tutorialNote: 'Voice: Malena · Music:',
    pathsEyebrow: 'Two paths',
    pathsTitle: 'Choose how your video is born',
    pathsLede: 'Both end in an MP4 ready to publish, with voice, music and captions.',
    motionTitle: 'Motion graphics',
    motionText: 'You write the script and the studio designs animated scenes with your brand: kinetic titles, devices with their screens, phones, dashboards and photos.',
    motionPoints: ['Storyboard proposed by the AI', 'Cuts on the music beat', 'Adjustments by chatting with the producer'],
    motionAlt: 'Motion graphics brief with brand, format, music and script',
    footageTitle: 'Raw footage',
    footageText: 'Bring screen recordings, camera clips or photos and the producer edits: it trims silences, places B-roll, adds captions and the voice-over.',
    footagePoints: ['A suggested role for every file', 'Tutorial, vertical and Product ad recipes', 'Free B-roll from Wikimedia Commons and NASA'],
    footageAlt: 'Conversation with the producer and the preview of a finished render',
    pathsCta: 'See the step-by-step tour',
    pipelineEyebrow: 'The pipeline',
    pipelineTitle: 'Five stages, one studio',
    pipelineLabel: 'Stages of the Video Maker pipeline',
    pipelineCta: 'How each stage works',
    featuresEyebrow: 'Why Video Maker',
    featuresTitle: 'Built to produce, not to fight the editor',
    features: [
      { icon: 'lock', title: 'Local first', textHtml: 'Transcription, voice, mixing and rendering run on your Mac. Only the conversation text goes to the AI you choose.' },
      { icon: 'chat', title: 'A producer you talk to', textHtml: 'Claude Code with your subscription or OpenRouter with your key. It proposes, explains and redoes only what you asked to change.' },
      { icon: 'voice', title: 'Spanish voices', textHtml: 'Piper es_AR, es_ES and es_MX voices synthesized on your machine, keeping the best take per sentence.' },
      { icon: 'captions', title: 'Kinetic captions', textHtml: 'One to three words per screen, inside the safe zones of Reels, TikTok and YouTube.' },
      { icon: 'brand', title: 'Your brand in every video', textHtml: 'Colors, logo, fonts, voice and music in an editable kit with a live preview.' },
      { icon: 'upload', title: 'Publish without leaving', textHtml: 'Upload to your YouTube channel with a title, description and credits proposed by the producer.' },
    ],
    galleryEyebrow: 'See it',
    galleryTitle: 'Real screenshots of the app',
    gallery: [
      ['home-projects.png', 'Your videos: project list with real thumbnails and their status'],
      ['motion-video.png', 'A finished motion graphics video, with the music credit for the description'],
      ['workspace-preview.png', 'Conversation with the producer and the preview of a finished render'],
      ['proposal-card.png', 'When you drop a file, the producer suggests a role to confirm or discard'],
    ],
    requirementsEyebrow: 'Before you download',
    requirementsTitle: 'What you need',
    requirementsHeaders: ['Requirement', 'Details'],
    requirements: (ctx) => [
      ['Mac', 'Apple Silicon (M1 or later). There is no Intel, Windows or Linux build.'],
      ['macOS', '13 Ventura or newer.'],
      ['Disk space', 'about 2 GB free (the installed app, the installer and the first-run downloads).'],
      ['An AI engine', `Claude Code with your own subscription, <strong>or</strong> an OpenRouter API key with credit — see <a href="${pageHref(ctx, 'connect-ai')}">Connect the AI</a>.`],
    ],
    requirementsNote: (ctx) =>
      `First time? Follow the <a href="${pageHref(ctx, 'installation')}">installation guide</a>: there is one extra step because the app is not signed with an Apple Developer ID.`,
    openEyebrow: 'Open source',
    openTitle: 'Read the code, propose changes, build your own',
    openText:
      'Video Maker is an Nx monorepo in TypeScript under the MIT license. Every feature starts from a spec and every fix is recorded, so you can follow why things are built the way they are.',
    openTech: 'See all the technology',
    openContribute: 'How to contribute',
    finalTitle: 'Your next video starts with an idea',
    finalText: 'Download the app, connect the AI and tell the producer what you want to say.',
  },
};

const MINI_TIMELINE_CLIPS = [
  [[2, 30], [36, 28], [68, 26]],
  [[2, 18], [22, 22], [46, 16], [64, 20], [86, 12]],
  [[2, 96]],
  [[6, 10], [24, 12], [44, 10], [62, 14], [82, 12]],
];

function miniTimeline(copy) {
  const tracks = copy.tracks
    .map((label, trackIndex) => {
      const clips = MINI_TIMELINE_CLIPS[trackIndex]
        .map(([start, width]) => `<span class="mini-timeline__clip" style="--clip-start:${start}%;--clip-width:${width}%"></span>`)
        .join('');
      return `<div class="mini-timeline__track mini-timeline__track--${trackIndex + 1}"><span class="mini-timeline__label">${escapeHtml(label)}</span><span class="mini-timeline__lane">${clips}</span></div>`;
    })
    .join('');
  return `<div class="mini-timeline" aria-hidden="true">${tracks}<span class="mini-timeline__playhead"></span></div>`;
}

function hero(ctx, copy) {
  const chips = copy.chips
    .map((chip, index) => `<span class="floating-chip floating-chip--${index + 1}" aria-hidden="true">${escapeHtml(chip)}</span>`)
    .join('');
  return `<section class="hero">
<div class="hero__backdrop" aria-hidden="true"></div>
<div class="container hero__grid">
<div class="hero__copy">
<p class="eyebrow-pill"><span class="rec-dot" aria-hidden="true"></span>${escapeHtml(copy.eyebrow)}</p>
<h1 class="hero__title">${escapeHtml(copy.titleLead)} <span class="gradient-text">${escapeHtml(copy.titleAccent)}</span></h1>
<p class="hero__lede">${copy.lede}</p>
<div class="hero__actions">
${downloadButton(ctx)}
${githubButton(ctx)}
</div>
<p class="hero__meta">${APPROX_DMG_SIZE_LABEL} · ${escapeHtml(copy.meta)}</p>
</div>
<div class="hero__visual">
<div class="app-window">
<div class="app-window__bar" aria-hidden="true"><span></span><span></span><span></span><p>${escapeHtml(APP_DISPLAY_NAME)}</p></div>
${screenshotFigure(ctx, 'motion-video.png', copy.heroAlt, { eager: true, className: 'app-window__shot' })}
${miniTimeline(copy)}
</div>
${chips}
</div>
</div>
</section>`;
}

function tutorialSection(ctx, copy) {
  const poster = assetHref(ctx, 'assets/screenshots/tutorial-poster.jpg');
  return `<section class="section section--tinted" aria-labelledby="home-tutorial">
<div class="container container--narrow">
${sectionHeader({ eyebrow: copy.tutorialEyebrow, title: copy.tutorialTitle, lede: escapeHtml(copy.tutorialLede), id: 'home-tutorial' })}
<figure class="tutorial-video reveal">
<video controls preload="none" playsinline poster="${poster}" aria-label="${escapeHtml(copy.tutorialLabel)}" width="1920" height="1080">
<source src="${TUTORIAL_VIDEO_PATH}" type="video/mp4" />
</video>
<figcaption>${escapeHtml(copy.tutorialNote)} <a href="${TUTORIAL_MUSIC_SOURCE_URL}" rel="noopener">Inspiring Advertising - Upbeat Summer Corporate</a>, Rafael Krux, CC BY 4.0</figcaption>
</figure>
</div>
</section>`;
}

function pathCard(ctx, { title, text, points, file, alt, iconName, anchor }) {
  const items = points.map((point) => `<li>${icon('arrowRight', 'icon icon--bullet')}${escapeHtml(point)}</li>`).join('');
  return `<article class="path-card reveal">
${screenshotFigure(ctx, file, alt, { className: 'path-card__shot' })}
<div class="path-card__body">
<h3 class="path-card__title">${icon(iconName)}<span>${escapeHtml(title)}</span></h3>
<p>${escapeHtml(text)}</p>
<ul class="check-list">${items}</ul>
<a class="text-link" href="${pageHref(ctx, 'how-it-works')}#${anchor}">${escapeHtml(t(ctx.locale, 'nav.how-it-works'))} ${icon('arrowRight', 'icon icon--inline')}</a>
</div>
</article>`;
}

function pathsSection(ctx, copy) {
  const anchors = ctx.locale === 'es' ? ['camino-motion', 'camino-material'] : ['path-motion', 'path-footage'];
  return `<section class="section" aria-labelledby="home-paths">
<div class="container">
${sectionHeader({ eyebrow: copy.pathsEyebrow, title: copy.pathsTitle, lede: escapeHtml(copy.pathsLede), id: 'home-paths' })}
<div class="path-cards">
${pathCard(ctx, { title: copy.motionTitle, text: copy.motionText, points: copy.motionPoints, file: 'motion-brief.png', alt: copy.motionAlt, iconName: 'brand', anchor: anchors[0] })}
${pathCard(ctx, { title: copy.footageTitle, text: copy.footageText, points: copy.footagePoints, file: 'workspace-preview.png', alt: copy.footageAlt, iconName: 'upload', anchor: anchors[1] })}
</div>
</div>
</section>`;
}

function pipelineSection(ctx, copy) {
  return `<section class="section section--tinted" aria-labelledby="home-pipeline">
<div class="container">
${sectionHeader({ eyebrow: copy.pipelineEyebrow, title: copy.pipelineTitle, id: 'home-pipeline' })}
${pipelineDiagram(pipelineStages(ctx.locale), { label: copy.pipelineLabel, compact: true })}
<p class="section-cta"><a class="button button--secondary" href="${pageHref(ctx, 'how-it-works')}">${escapeHtml(copy.pipelineCta)} ${icon('arrowRight')}</a></p>
</div>
</section>`;
}

function featuresSection(copy) {
  return `<section class="section" aria-labelledby="home-features">
<div class="container">
${sectionHeader({ eyebrow: copy.featuresEyebrow, title: copy.featuresTitle, id: 'home-features' })}
${featureGrid(copy.features)}
</div>
</section>`;
}

function gallerySection(ctx, copy) {
  const shots = copy.gallery.map(([file, alt]) => screenshotFigure(ctx, file, alt, { caption: alt, className: 'screenshot screenshot--card reveal' })).join('');
  return `<section class="section section--tinted" aria-labelledby="home-gallery">
<div class="container">
${sectionHeader({ eyebrow: copy.galleryEyebrow, title: copy.galleryTitle, id: 'home-gallery' })}
<div class="screenshot-grid">${shots}</div>
</div>
</section>`;
}

function requirementsSection(ctx, copy) {
  return `<section class="section" aria-labelledby="home-requirements">
<div class="container container--narrow">
${sectionHeader({ eyebrow: copy.requirementsEyebrow, title: copy.requirementsTitle, id: 'home-requirements' })}
${infoTable(copy.requirementsHeaders, copy.requirements(ctx))}
<p class="muted">${copy.requirementsNote(ctx)}</p>
</div>
</section>`;
}

function openSourceSection(ctx, copy) {
  return `<section class="section" aria-labelledby="home-open-source">
<div class="container">
<div class="open-band reveal">
<div class="open-band__copy">
<p class="eyebrow">${escapeHtml(copy.openEyebrow)}</p>
<h2 class="section-title" id="home-open-source">${escapeHtml(copy.openTitle)}</h2>
<p>${escapeHtml(copy.openText)}</p>
<div class="open-band__actions">
${githubButton(ctx, 'button button--primary')}
<a class="button button--ghost" href="${pageHref(ctx, 'open-source')}">${escapeHtml(copy.openContribute)}</a>
<a class="button button--ghost" href="${pageHref(ctx, 'technology')}">${escapeHtml(copy.openTech)}</a>
</div>
</div>
<pre class="open-band__code" aria-hidden="true"><code><span class="code-muted">$</span> git clone ${escapeHtml(REPO_URL)}.git
<span class="code-muted">$</span> pnpm install
<span class="code-muted">$</span> pnpm fetch:dev-voices
<span class="code-muted">$</span> pnpm studio</code></pre>
</div>
</div>
</section>`;
}

function finalCta(ctx, copy) {
  return `<section class="section final-cta" aria-labelledby="home-final">
<div class="container final-cta__inner reveal">
<h2 class="section-title" id="home-final">${escapeHtml(copy.finalTitle)}</h2>
<p class="section-lede">${escapeHtml(copy.finalText)}</p>
<div class="hero__actions hero__actions--center">${downloadButton(ctx)}${githubButton(ctx)}</div>
</div>
</section>`;
}

export function renderPage(ctx) {
  const copy = pick(ctx.locale, COPY);
  const bodyHtml = [
    hero(ctx, copy),
    tutorialSection(ctx, copy),
    pathsSection(ctx, copy),
    pipelineSection(ctx, copy),
    featuresSection(copy),
    gallerySection(ctx, copy),
    openSourceSection(ctx, copy),
    requirementsSection(ctx, copy),
    finalCta(ctx, copy),
  ].join('\n');
  return { title: copy.title, description: copy.description, bodyHtml };
}
