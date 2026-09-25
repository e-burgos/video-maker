import { APP_DISPLAY_NAME, DOWNLOAD_URL } from '../site-config.mjs';
import { calloutBox, screenshotFigure, stepList } from '../render.mjs';

export function renderPage(depth) {
  const bodyHtml = `
<h1>Instalación</h1>
<p class="lede">
${APP_DISPLAY_NAME} no tiene firma de Apple Developer (cuesta USD 99 al año y esto se reparte
gratis entre amigos), así que macOS pide un paso extra la primera vez que la abrís. Después de
ese primer paso, se abre normal.
</p>

${calloutBox(
  'warning',
  '<p><strong>Importante:</strong> movés el ícono de "Video Maker" a la carpeta Aplicaciones ANTES de abrirla ' +
    'por primera vez. Si la abrís directo desde el .dmg montado o desde Descargas, macOS puede correrla desde una ' +
    'copia temporal invisible ("App Translocation") y algunas cosas no se comportan bien. Arrastrarla a ' +
    'Aplicaciones primero evita todo eso.</p>',
)}

${stepList([
  {
    title: 'Bajá el .dmg y montalo',
    bodyHtml: `<p>Con el botón de <a href="${DOWNLOAD_URL}">descarga</a> de la portada. Doble clic en el
archivo <code>.dmg</code> descargado — se abre una ventana con el ícono de "Video Maker".</p>`,
  },
  {
    title: 'Arrastrá el ícono a Aplicaciones',
    bodyHtml:
      '<p>En la misma ventana, arrastrá "Video Maker" sobre el acceso directo a la carpeta "Applications"/"Aplicaciones". Esto la instala y evita App Translocation (ver arriba).</p>',
  },
  {
    title: 'Abrí "Video Maker" desde Aplicaciones (o Launchpad) — primer diálogo',
    bodyHtml: `<p>Doble clic. Va a aparecer un diálogo como este, con un solo botón:</p>
${screenshotFigure(depth, 'gatekeeper-not-opened.png', 'Diálogo de macOS: “Video Maker.app” No Opened / No se pudo abrir, con los botones Move to Trash / Mover a la papelera y Done / Listo')}
<p><strong>NO</strong> hagas clic en "Move to Trash" / "Mover a la papelera". Hacé clic en
<strong>"Done"</strong> (si tu Mac está en inglés) o <strong>"Listo"</strong> (si está en español) y seguí
al próximo paso — este diálogo no tiene un botón para abrirla igual, hay que ir a Ajustes.</p>`,
  },
  {
    title: 'Ajustes del Sistema → Privacidad y seguridad → "Abrir igual"',
    bodyHtml: `<p>Abrí <strong>System Settings</strong> (inglés) / <strong>Ajustes del Sistema</strong> (español) →
<strong>Privacy &amp; Security</strong> / <strong>Privacidad y seguridad</strong>. Bajá hasta la sección
"Security"/"Seguridad": vas a ver un mensaje diciendo que "Video Maker" fue bloqueada. Hacé clic en
<strong>"Open Anyway"</strong> / <strong>"Abrir de todos modos"</strong>.</p>`,
  },
  {
    title: 'Confirmá con Touch ID o tu contraseña',
    bodyHtml:
      '<p>macOS pide una confirmación (huella o la contraseña de tu usuario) y después un segundo diálogo con un botón "Open"/"Abrir". Confirmá ahí y la app arranca.</p>',
  },
  {
    title: 'Las próximas veces abre directo',
    bodyHtml:
      '<p>macOS recuerda esta aprobación por ruta y por versión: no vas a tener que repetir este camino salvo que reinstales una versión nueva del .dmg.</p>',
  },
])}

<h2>Alternativa por Terminal</h2>
<p>
Si preferís no tocar Ajustes del Sistema, con la app ya en Aplicaciones podés quitarle la
cuarentena a mano desde Terminal:
</p>
<pre><code>xattr -dr com.apple.quarantine "/Applications/Video Maker.app"</code></pre>
<p>Después abrila normal, doble clic desde Aplicaciones.</p>
`;

  return {
    title: 'Instalación',
    description: 'Cómo instalar Video Maker y abrir una app sin firma de Apple: el diálogo de Gatekeeper paso a paso.',
    bodyHtml,
  };
}
