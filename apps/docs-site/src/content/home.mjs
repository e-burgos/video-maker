import {
  APPROX_DMG_SIZE_LABEL,
  APP_DISPLAY_NAME,
  DOWNLOAD_URL,
} from '../site-config.mjs';
import { downloadButton, infoTable, pageHref, screenshotFigure } from '../render.mjs';

export function renderPage(depth) {
  const bodyHtml = `
<h1>${APP_DISPLAY_NAME}</h1>
<p class="lede">
Armá videos con la ayuda de un productor de IA que trabaja con tu propio material. La app corre
entera en tu Mac: sube guion, corte, subtítulos, locución y música, y vos confirmás cada paso;
solo la conversación con el productor sale de tu máquina.
</p>

<div class="hero-actions">
${downloadButton(DOWNLOAD_URL, 'Descargar para Mac (Apple Silicon)')}
<span class="download-meta">${APPROX_DMG_SIZE_LABEL} · macOS 13 Ventura o posterior</span>
</div>

<h2>Qué necesitás</h2>
${infoTable(
  ['Requisito', 'Detalle'],
  [
    ['Mac', 'Apple Silicon (M1 o superior). No hay versión para Intel ni para Windows/Linux.'],
    ['macOS', '13 Ventura o más nuevo.'],
    ['Espacio en disco', 'unos 2 GB libres (la app instalada, el instalador y las descargas del primer arranque).'],
    [
      'Un motor de IA',
      'Claude Code con tu propia suscripción, <strong>o</strong> una API key de OpenRouter con crédito cargado — se explica en <a href="' +
        pageHref(depth, 'conectar-ia') +
        '">Conectar la IA</a>.',
    ],
  ],
)}

<p>
¿Primera vez? Seguí la guía de <a href="${pageHref(depth, 'instalacion')}">instalación</a> — un
paso extra porque la app no tiene firma de Apple Developer (es gratis, entre amigos).
</p>

<h2>Así se ve</h2>
<div class="screenshot-grid">
${screenshotFigure(depth, 'home-projects.png', 'Lista de proyectos de Video Maker Studio, cada uno con sus categorías de material')}
${screenshotFigure(depth, 'home-chat.png', 'Conversación con el productor de IA dentro de un proyecto, con recetas sugeridas')}
${screenshotFigure(depth, 'home-deliveries.png', 'Panel de entregas de un proyecto, con el guion y las opciones de material a subir')}
</div>
`;

  return {
    title: 'Inicio',
    description: 'Video Maker: armá videos con un productor de IA que corre en tu Mac. Bajalo, instalalo y empezá.',
    bodyHtml,
  };
}
