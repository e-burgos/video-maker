import { APPROX_FIRST_RUN_DOWNLOAD_LABEL, APP_DISPLAY_NAME } from '../site-config.mjs';
import { calloutBox, infoTable, pageHref, stepList } from '../render.mjs';

export function renderPage(depth) {
  const bodyHtml = `
<h1>Primer arranque</h1>
<p class="lede">
La primera vez que abrís ${APP_DISPLAY_NAME} (ya instalada en Aplicaciones, ver
<a href="${pageHref(depth, 'instalacion')}">Instalación</a>) la app te guía por una ventana de
configuración antes de mostrarte el estudio.
</p>

${stepList([
  {
    title: 'Descarga de lo que hace falta para editar',
    bodyHtml: `<p>La app descarga los modelos que corren en tu máquina para transcribir, generar voces y renderizar
video. Se puede cortar y retomar; se verifica el tamaño y el sha256 de cada archivo.</p>
${infoTable(
  ['Qué se baja', 'Tamaño aprox.'],
  [
    ['Modelo de transcripción (whisper)', '≈574 MB'],
    ['Tres voces en español (es_AR, es_ES, es_MX)', '≈250 MB'],
    ['Navegador para renderizar (Chrome headless)', '≈98 MB'],
    [`<strong>Total</strong>`, `<strong>${APPROX_FIRST_RUN_DOWNLOAD_LABEL}</strong>`],
  ],
)}`,
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
Si no la tenés, no pasa nada: podés usar OpenRouter (ver <a href="${pageHref(depth, 'conectar-ia')}">Conectar la IA</a>) o instalar Claude Code más tarde.</p>`,
  },
])}

${calloutBox(
  'warning',
  '<p>Sin Claude ni una key de OpenRouter cargada, el productor no puede conversar con vos — el resto de la app ' +
    '(subir material, ver proyectos) funciona igual.</p>',
)}
`;

  return {
    title: 'Primer arranque',
    description: 'Qué descarga Video Maker la primera vez, cómo elegir la carpeta de proyectos y el chequeo de Claude.',
    bodyHtml,
  };
}
