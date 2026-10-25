import { pick } from '../i18n.mjs';
import { icon } from '../icons.mjs';
import { pageHref } from '../routes.mjs';
import { escapeHtml, infoTable, pageHero, sectionHeader } from '../render.mjs';
import { pathWalkthroughs, pipelineDiagram } from '../components.mjs';
import { creationPaths, pipelineStages } from './journeys.mjs';

const COPY = {
  es: {
    title: 'Cómo funciona',
    description: 'El pipeline de Video Maker etapa por etapa y un recorrido guiado por los dos caminos: motion graphics y material crudo.',
    eyebrow: 'Guía interactiva',
    heading: 'Cómo funciona Video Maker',
    lede: 'De la idea al MP4 en cinco etapas. Abajo, el recorrido por cada camino con capturas reales de la app.',
    pipelineTitle: 'El pipeline',
    pipelineLabel: 'Etapas del pipeline de Video Maker',
    beforeTitle: 'Antes de empezar',
    before: [
      { pageId: 'installation', icon: 'download', title: 'Instalá la app', text: 'Arrastrala a Aplicaciones y abrila con un paso extra (no tiene firma de Apple).' },
      { pageId: 'first-run', icon: 'voice', title: 'Primer arranque', text: 'Baja los modelos de transcripción, las voces y el navegador de render (≈879 MB).' },
      { pageId: 'connect-ai', icon: 'chat', title: 'Conectá la IA', text: 'Claude Code con tu suscripción u OpenRouter con tu key y crédito prepago.' },
    ],
    pathsTitle: 'Los dos caminos, paso a paso',
    pathsLede: 'Elegí un camino y avanzá con los botones o con las flechas del teclado.',
    whereTitle: 'Qué corre dónde',
    whereHeaders: ['Etapa', 'Dónde corre', 'Con qué'],
    whereRows: [
      ['Conversación, guion y storyboard', 'En la IA que conectaste', 'Claude Code (tu suscripción) u OpenRouter (tu key)'],
      ['Transcripción', 'En tu Mac', 'whisper.cpp con el modelo large-v3-turbo'],
      ['Voz', 'En tu Mac', 'Voces Piper con sherpa-onnx (opcional: ElevenLabs con tu key)'],
      ['Escenas y render', 'En tu Mac', 'Remotion + Chrome headless (material crudo) · HyperFrames + GSAP (motion graphics)'],
      ['Mezcla, máster y revisión', 'En tu Mac', 'FFmpeg / ffprobe'],
      ['Publicación', 'En tu canal', 'YouTube Data API v3, sólo si conectás tu cuenta'],
    ],
    techLink: 'Ver el inventario completo de tecnología y licencias',
  },
  en: {
    title: 'How it works',
    description: 'The Video Maker pipeline stage by stage and a guided tour of both paths: motion graphics and raw footage.',
    eyebrow: 'Interactive guide',
    heading: 'How Video Maker works',
    lede: 'From idea to MP4 in five stages. Below, a tour of each path with real screenshots of the app (shown with its Spanish interface).',
    pipelineTitle: 'The pipeline',
    pipelineLabel: 'Stages of the Video Maker pipeline',
    beforeTitle: 'Before you start',
    before: [
      { pageId: 'installation', icon: 'download', title: 'Install the app', text: 'Drag it to Applications and open it with one extra step (it is not signed by Apple).' },
      { pageId: 'first-run', icon: 'voice', title: 'First run', text: 'It downloads the transcription model, the voices and the rendering browser (≈879 MB).' },
      { pageId: 'connect-ai', icon: 'chat', title: 'Connect the AI', text: 'Claude Code with your subscription or OpenRouter with your key and prepaid credit.' },
    ],
    pathsTitle: 'Both paths, step by step',
    pathsLede: 'Pick a path and move with the buttons or the arrow keys.',
    whereTitle: 'What runs where',
    whereHeaders: ['Stage', 'Where it runs', 'With what'],
    whereRows: [
      ['Conversation, script and storyboard', 'On the AI you connected', 'Claude Code (your subscription) or OpenRouter (your key)'],
      ['Transcription', 'On your Mac', 'whisper.cpp with the large-v3-turbo model'],
      ['Voice', 'On your Mac', 'Piper voices on sherpa-onnx (optional: ElevenLabs with your key)'],
      ['Scenes and rendering', 'On your Mac', 'Remotion + headless Chrome (raw footage) · HyperFrames + GSAP (motion graphics)'],
      ['Mixing, mastering and review', 'On your Mac', 'FFmpeg / ffprobe'],
      ['Publishing', 'On your channel', 'YouTube Data API v3, only if you connect your account'],
    ],
    techLink: 'See the full technology and license inventory',
  },
};

function beforeCards(ctx, copy) {
  const cards = copy.before
    .map(
      (card, index) => `<li class="mini-card reveal">
<a href="${pageHref(ctx, card.pageId)}">
<span class="mini-card__index">${index + 1}</span>
<span class="mini-card__icon">${icon(card.icon)}</span>
<span class="mini-card__title">${escapeHtml(card.title)}</span>
<span class="mini-card__text">${escapeHtml(card.text)}</span>
</a>
</li>`,
    )
    .join('');
  return `<ol class="mini-cards">${cards}</ol>`;
}

export function renderPage(ctx) {
  const copy = pick(ctx.locale, COPY);
  const bodyHtml = `
${pageHero({ eyebrow: copy.eyebrow, title: copy.heading, lede: escapeHtml(copy.lede) })}
<section class="section section--flush-top" aria-labelledby="pipeline-title">
<div class="container">
${sectionHeader({ title: copy.pipelineTitle, id: 'pipeline-title' })}
${pipelineDiagram(pipelineStages(ctx.locale), { label: copy.pipelineLabel })}
</div>
</section>
<section class="section section--tinted" aria-labelledby="before-title">
<div class="container">
${sectionHeader({ title: copy.beforeTitle, id: 'before-title' })}
${beforeCards(ctx, copy)}
</div>
</section>
<section class="section" aria-labelledby="paths-title">
<div class="container">
${sectionHeader({ title: copy.pathsTitle, lede: escapeHtml(copy.pathsLede), id: 'paths-title' })}
${pathWalkthroughs(ctx, creationPaths(ctx.locale))}
</div>
</section>
<section class="section section--tinted" aria-labelledby="where-title">
<div class="container container--narrow">
${sectionHeader({ title: copy.whereTitle, id: 'where-title' })}
${infoTable(copy.whereHeaders, copy.whereRows.map((row) => row.map(escapeHtml)))}
<p><a class="text-link" href="${pageHref(ctx, 'technology')}">${escapeHtml(copy.techLink)} ${icon('arrowRight', 'icon icon--inline')}</a></p>
</div>
</section>`;
  return { title: copy.title, description: copy.description, bodyHtml };
}
