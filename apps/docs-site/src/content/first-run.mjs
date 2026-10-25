import { APPROX_FIRST_RUN_DOWNLOAD_LABEL, APP_DISPLAY_NAME } from '../site-config.mjs';
import { pageHref } from '../routes.mjs';
import { calloutBox, infoTable, screenshotFigure, stepList } from '../render.mjs';

const DOWNLOAD_ROWS = {
  es: [
    ['Modelo de transcripción (whisper)', '547 MB'],
    ['Voz es_AR-daniela-high', '110 MB'],
    ['Voz es_ES-davefx-medium', '64 MB'],
    ['Voz es_MX-claude-high', '64 MB'],
    ['Navegador para renderizar (Chrome headless)', '94 MB'],
  ],
  en: [
    ['Transcription model (whisper)', '547 MB'],
    ['Voice es_AR-daniela-high', '110 MB'],
    ['Voice es_ES-davefx-medium', '64 MB'],
    ['Voice es_MX-claude-high', '64 MB'],
    ['Rendering browser (headless Chrome)', '94 MB'],
  ],
};

function downloadsTable(locale) {
  const headers = locale === 'es' ? ['Qué se baja', 'Tamaño'] : ['What is downloaded', 'Size'];
  return infoTable(headers, [...DOWNLOAD_ROWS[locale], ['<strong>Total</strong>', `<strong>${APPROX_FIRST_RUN_DOWNLOAD_LABEL}</strong>`]]);
}

function bodyEs(ctx) {
  return `
<h1>Primer arranque</h1>
<p class="lede">
La primera vez que abrís ${APP_DISPLAY_NAME} (ya instalada en Aplicaciones, ver
<a href="${pageHref(ctx, 'installation')}">Instalación</a>) la app te guía por una ventana de
configuración antes de mostrarte el estudio.
</p>

${stepList([
  {
    title: 'Descarga de lo que hace falta para editar',
    bodyHtml: `<p>La app descarga los modelos que corren en tu máquina para transcribir, generar voces y renderizar
video. Se puede cortar y retomar; se verifica el tamaño y el sha256 de cada archivo.</p>
${screenshotFigure(ctx, 'first-run-setup.png', 'Ventana de primer arranque mostrando la lista de descargas: modelo de transcripción, tres voces y el navegador para renderizar')}
${downloadsTable('es')}`,
  },
  {
    title: 'Elegí tu carpeta de proyectos',
    bodyHtml:
      '<p>Dónde van a vivir tus videos y su material. Podés dejar la que propone la app o elegir cualquier carpeta con espacio — se puede cambiar más adelante desde el menú.</p>',
  },
  {
    title: 'Chequeo de Claude (opcional)',
    bodyHtml: `<p>La app busca si tenés instalada la CLI de <code>claude</code> y una sesión iniciada. Si la
encuentra, muestra "Encontrado" y ya podés usar Claude como motor del productor sin cargar ninguna key.
Si no la tenés, no pasa nada: podés usar OpenRouter (ver <a href="${pageHref(ctx, 'connect-ai')}">Conectar la IA</a>) o instalar Claude Code más tarde.</p>`,
  },
])}

${calloutBox(
  'warning',
  '<p>Sin Claude ni una key de OpenRouter cargada, el productor no puede conversar con vos — el resto de la app ' +
    '(subir material, ver proyectos) funciona igual.</p>',
)}
`;
}

function bodyEn(ctx) {
  return `
<h1>First run</h1>
<p class="lede">
The first time you open ${APP_DISPLAY_NAME} (already installed in Applications, see
<a href="${pageHref(ctx, 'installation')}">Installation</a>) the app walks you through a setup
window before showing you the studio.
</p>

${stepList([
  {
    title: 'Downloading what editing needs',
    bodyHtml: `<p>The app downloads the models that run on your machine to transcribe, generate voices and render
video. It can be interrupted and resumed; the size and sha256 of every file are verified.</p>
${screenshotFigure(ctx, 'first-run-setup.png', 'First-run window listing the downloads: transcription model, three voices and the rendering browser')}
${downloadsTable('en')}`,
  },
  {
    title: 'Pick your projects folder',
    bodyHtml:
      '<p>Where your videos and their material will live. Keep the one the app suggests or choose any folder with enough space — you can change it later from the menu.</p>',
  },
  {
    title: 'Claude check (optional)',
    bodyHtml: `<p>The app looks for the <code>claude</code> CLI and a signed-in session. If it finds them, it shows
that Claude was found and you can use Claude as the producer engine without entering any key.
If you do not have it, no problem: use OpenRouter (see <a href="${pageHref(ctx, 'connect-ai')}">Connect the AI</a>) or install Claude Code later.</p>`,
  },
])}

${calloutBox(
  'warning',
  '<p>Without Claude or an OpenRouter key, the producer cannot chat with you — the rest of the app ' +
    '(uploading material, browsing projects) works the same.</p>',
)}
`;
}

const PAGES = {
  es: (ctx) => ({
    title: 'Primer arranque',
    description: 'Qué descarga Video Maker la primera vez, cómo elegir la carpeta de proyectos y el chequeo de Claude.',
    bodyHtml: bodyEs(ctx),
  }),
  en: (ctx) => ({
    title: 'First run',
    description: 'What Video Maker downloads the first time, how to pick the projects folder and the Claude check.',
    bodyHtml: bodyEn(ctx),
  }),
};

export function renderPage(ctx) {
  return PAGES[ctx.locale](ctx);
}
