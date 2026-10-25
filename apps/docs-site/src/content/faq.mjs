import { APPLICATION_SUPPORT_PATH } from '../site-config.mjs';
import { faqItem } from '../render.mjs';
import { pageHref } from '../routes.mjs';

function bodyEs(ctx) {
  return `
<h1>Preguntas frecuentes</h1>

${faqItem(
  '¿Dónde vive mi material y mis videos?',
  `<p>Por defecto, en una carpeta dentro de <code>${APPLICATION_SUPPORT_PATH}</code> — la elegís (o confirmás) en el
primer arranque, y la podés cambiar después desde el menú de la app ("Preferencias" → "Carpeta de proyectos…").
Cada proyecto es una carpeta con tu material crudo, lo que produce el productor y los renders finales.</p>`,
)}

${faqItem(
  '¿Dónde están los logs si algo falla?',
  `<p>Desde el menú de la app: "Ayuda" → "Abrir carpeta de logs". Ahí vive el log del servicio local que hace el
trabajo pesado (transcripción, render, etc.) — útil para reportar un problema.</p>`,
)}

${faqItem(
  '¿Cómo la desinstalo por completo?',
  `<p>Tres pasos: (1) arrastrá "Video Maker" desde Aplicaciones a la Papelera; (2) si cargaste una key de OpenRouter,
abrí la app "Acceso a Llaveros" ("Keychain Access"), buscá el ítem <strong>"Video Maker"</strong> y borralo; (3) si
querés borrar también tus proyectos y los modelos descargados, borrá la carpeta
<code>${APPLICATION_SUPPORT_PATH}</code> completa — hacelo solo si no te importa perder tus videos y su material.</p>`,
)}

${faqItem(
  '¿Cómo actualizo a una versión nueva?',
  '<p>Bajá el .dmg más nuevo desde la misma página de descarga y arrastrala de nuevo a Aplicaciones, reemplazando la anterior. No hay auto-actualización (la firma ad hoc de Electron no la permite en macOS) — tus proyectos y configuración no se tocan, viven aparte de la app.</p>',
)}

${faqItem(
  '¿Sale algo de mi material a internet?',
  '<p>No. La transcripción, la generación de voz y el render final corren con binarios instalados localmente (ffmpeg, whisper.cpp, sherpa-onnx, Remotion, HyperFrames). Lo que sale de tu máquina es el texto de la conversación con el productor, hacia Claude o hacia OpenRouter según cuál hayas conectado — y, sólo si los usás, el texto de la locución hacia ElevenLabs y el video que elegís publicar hacia YouTube.</p>',
)}

${faqItem(
  '¿El código es abierto?',
  `<p>Sí, con licencia MIT. El repositorio, cómo correrlo y cómo contribuir están en <a href="${pageHref(ctx, 'open-source')}">Código abierto</a>; qué usa cada parte y con qué licencia, en <a href="${pageHref(ctx, 'technology')}">Tecnología</a>.</p>`,
)}

${faqItem(
  '¿Por qué el video no muestra el crédito de la música?',
  '<p>Porque queda mejor en la descripción. Los temas de la marca son de Kevin MacLeod con licencia CC BY 4.0, que pide nombrar al autor: el texto exacto aparece debajo del reproductor en la página Motion y en <code>out/video.credits.txt</code> de cada proyecto. Pegalo en la descripción cada vez que publiques el video.</p>',
)}

${faqItem(
  '¿Qué necesito para un video de motion graphics?',
  '<p>Un guion y, si querés, unas fotos con una línea que diga qué muestran. La IA arma el storyboard con el motor que tengas conectado (Claude con tu suscripción u OpenRouter); la voz, la música y el render corren en tu Mac. Un video de un minuto tarda unos minutos en el storyboard y otros cinco a diez en voz y render.</p>',
)}

${faqItem(
  '¿Cómo cambio algo de un video de motion graphics que ya hice?',
  '<p>Abrí el video, tocá "Ajustar con el productor" y pedí el cambio en tus palabras (la música, un texto, una frase de la voz, el orden de las escenas). El productor edita solo esas escenas y rehace el video; la voz se vuelve a grabar únicamente donde cambió el texto, así que un ajuste chico tarda uno o dos minutos.</p>',
)}

${faqItem(
  '¿El storyboard funciona sin Claude?',
  '<p>Sí. El storyboard (la propuesta de escenas del video: qué se dice y qué se ve en cada una) se genera con el motor de IA que tengas conectado en Configuración — Claude Code u OpenRouter — así que no hace falta tener Claude para usarlo, alcanza con cualquiera de los dos.</p>',
)}
`;
}

function bodyEn(ctx) {
  return `
<h1>Frequently asked questions</h1>

${faqItem(
  'Where do my material and my videos live?',
  `<p>By default, in a folder inside <code>${APPLICATION_SUPPORT_PATH}</code> — you choose (or confirm) it on the
first run, and you can change it later from the app menu ("Preferencias" → "Carpeta de proyectos…", the desktop
menus are in Spanish). Every project is a folder with your raw material, what the producer makes and the final renders.</p>`,
)}

${faqItem(
  'Where are the logs if something fails?',
  `<p>From the app menu: "Ayuda" (Help) → "Abrir carpeta de logs" (Open logs folder). That is where the log of the
local service doing the heavy lifting (transcription, rendering, etc.) lives — useful when reporting a problem.</p>`,
)}

${faqItem(
  'How do I uninstall it completely?',
  `<p>Three steps: (1) drag "Video Maker" from Applications to the Trash; (2) if you entered an OpenRouter key,
open the "Keychain Access" app, find the <strong>"Video Maker"</strong> item and delete it; (3) if you also want to
delete your projects and the downloaded models, delete the whole <code>${APPLICATION_SUPPORT_PATH}</code> folder — only
do it if you do not mind losing your videos and their material.</p>`,
)}

${faqItem(
  'How do I update to a new version?',
  '<p>Download the newest .dmg from the same download page and drag it to Applications again, replacing the previous one. There is no auto-update (Electron’s ad hoc signature does not allow it on macOS) — your projects and settings are not touched, they live apart from the app.</p>',
)}

${faqItem(
  'Does any of my material go to the internet?',
  '<p>No. Transcription, voice generation and the final render run with binaries installed locally (ffmpeg, whisper.cpp, sherpa-onnx, Remotion, HyperFrames). What leaves your machine is the text of your conversation with the producer, to Claude or to OpenRouter depending on which one you connected — and, only if you use them, the voice-over text to ElevenLabs and the video you choose to publish to YouTube.</p>',
)}

${faqItem(
  'Is the code open source?',
  `<p>Yes, under the MIT license. The repository, how to run it and how to contribute are on <a href="${pageHref(ctx, 'open-source')}">Open source</a>; what each part uses and under which license, on <a href="${pageHref(ctx, 'technology')}">Technology</a>.</p>`,
)}

${faqItem(
  'Why does the video not show the music credit?',
  '<p>Because it fits better in the description. The brand tracks are by Kevin MacLeod under CC BY 4.0, which requires naming the author: the exact text appears below the player on the Motion page and in <code>out/video.credits.txt</code> in every project. Paste it into the description every time you publish the video.</p>',
)}

${faqItem(
  'What do I need for a motion graphics video?',
  '<p>A script and, if you like, a few photos with one line saying what they show. The AI builds the storyboard with the engine you connected (Claude with your subscription or OpenRouter); the voice, the music and the render run on your Mac. A one-minute video takes a few minutes for the storyboard and another five to ten for voice and rendering.</p>',
)}

${faqItem(
  'How do I change something in a motion graphics video I already made?',
  '<p>Open the video, tap "Adjust with the producer" and ask for the change in your own words (the music, a text, a line of the voice, the order of the scenes). The producer edits only those scenes and remakes the video; the voice is recorded again only where the text changed, so a small adjustment takes one or two minutes.</p>',
)}

${faqItem(
  'Does the storyboard work without Claude?',
  '<p>Yes. The storyboard (the proposed scenes of the video: what is said and what is shown in each one) is generated with the AI engine you connected in Settings — Claude Code or OpenRouter — so you do not need Claude to use it, either one is enough.</p>',
)}
`;
}

const PAGES = {
  es: (ctx) => ({
    title: 'Preguntas frecuentes',
    description: 'Dónde vive tu material, cómo desinstalar Video Maker por completo y otras dudas frecuentes.',
    bodyHtml: bodyEs(ctx),
  }),
  en: (ctx) => ({
    title: 'FAQ',
    description: 'Where your material lives, how to uninstall Video Maker completely and other common questions.',
    bodyHtml: bodyEn(ctx),
  }),
};

export function renderPage(ctx) {
  return PAGES[ctx.locale](ctx);
}
