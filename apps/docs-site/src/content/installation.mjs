import { APP_DISPLAY_NAME, DOWNLOAD_URL } from '../site-config.mjs';
import { calloutBox, screenshotFigure, stepList } from '../render.mjs';

function bodyEs(ctx) {
  return `
<h1>Instalación</h1>
<p class="lede">
${APP_DISPLAY_NAME} no tiene firma de Apple Developer (cuesta USD 99 al año y esto se reparte
gratis), así que macOS pide un paso extra la primera vez que la abrís. Después de
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
${screenshotFigure(ctx, 'gatekeeper-not-opened.png', 'Diálogo de macOS: “Video Maker.app” No Opened / No se pudo abrir, con los botones Move to Trash / Mover a la papelera y Done / Listo', { className: 'screenshot screenshot--small' })}
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
}

function bodyEn(ctx) {
  return `
<h1>Installation</h1>
<p class="lede">
${APP_DISPLAY_NAME} is not signed with an Apple Developer ID (it costs USD 99 a year and this app is
given away for free), so macOS asks for one extra step the first time you open it. After that first
step, it opens normally.
</p>

${calloutBox(
  'warning',
  '<p><strong>Important:</strong> move the "Video Maker" icon to the Applications folder BEFORE opening it ' +
    'for the first time. If you open it straight from the mounted .dmg or from Downloads, macOS may run it from a ' +
    'hidden temporary copy ("App Translocation") and some things will not behave. Dragging it to ' +
    'Applications first avoids all of that.</p>',
)}

${stepList([
  {
    title: 'Download the .dmg and mount it',
    bodyHtml: `<p>Use the <a href="${DOWNLOAD_URL}">download</a> button on the home page. Double-click the
downloaded <code>.dmg</code> file — a window opens with the "Video Maker" icon.</p>`,
  },
  {
    title: 'Drag the icon to Applications',
    bodyHtml:
      '<p>In that same window, drag "Video Maker" onto the shortcut to the "Applications" folder. This installs it and avoids App Translocation (see above).</p>',
  },
  {
    title: 'Open "Video Maker" from Applications (or Launchpad) — first dialog',
    bodyHtml: `<p>Double-click it. A dialog like this one appears, with a single button:</p>
${screenshotFigure(ctx, 'gatekeeper-not-opened.png', 'macOS dialog: “Video Maker.app” Not Opened, with the Move to Trash and Done buttons', { className: 'screenshot screenshot--small' })}
<p>Do <strong>NOT</strong> click "Move to Trash". Click <strong>"Done"</strong> and go on to the next
step — this dialog has no button to open the app anyway, you need to go to System Settings.</p>`,
  },
  {
    title: 'System Settings → Privacy & Security → "Open Anyway"',
    bodyHtml: `<p>Open <strong>System Settings</strong> → <strong>Privacy &amp; Security</strong>. Scroll down to the
"Security" section: you will see a message saying that "Video Maker" was blocked. Click
<strong>"Open Anyway"</strong>.</p>`,
  },
  {
    title: 'Confirm with Touch ID or your password',
    bodyHtml:
      '<p>macOS asks for a confirmation (fingerprint or your user password) and then shows a second dialog with an "Open" button. Confirm there and the app starts.</p>',
  },
  {
    title: 'From then on it opens directly',
    bodyHtml:
      '<p>macOS remembers this approval per path and per version: you will not have to repeat it unless you install a new version of the .dmg.</p>',
  },
])}

<h2>Terminal alternative</h2>
<p>
If you would rather not touch System Settings, with the app already in Applications you can remove the
quarantine flag yourself from Terminal:
</p>
<pre><code>xattr -dr com.apple.quarantine "/Applications/Video Maker.app"</code></pre>
<p>Then open it normally, double-clicking it in Applications.</p>
`;
}

const PAGES = {
  es: (ctx) => ({
    title: 'Instalación',
    description: 'Cómo instalar Video Maker y abrir una app sin firma de Apple: el diálogo de Gatekeeper paso a paso.',
    bodyHtml: bodyEs(ctx),
  }),
  en: (ctx) => ({
    title: 'Installation',
    description: 'How to install Video Maker and open an app without an Apple signature: the Gatekeeper dialog step by step.',
    bodyHtml: bodyEn(ctx),
  }),
};

export function renderPage(ctx) {
  return PAGES[ctx.locale](ctx);
}
