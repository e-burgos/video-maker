import { APPLICATION_SUPPORT_PATH } from '../site-config.mjs';
import { faqItem } from '../render.mjs';

export function renderPage() {
  const bodyHtml = `
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
  '<p>No. La transcripción, la generación de voz y el render final corren con binarios instalados localmente (ffmpeg, whisper.cpp, sherpa-onnx, Remotion). Lo único que sale de tu máquina es el texto de la conversación con el productor, hacia Claude o hacia OpenRouter, según cuál hayas conectado.</p>',
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

  return {
    title: 'Preguntas frecuentes',
    description: 'Dónde vive tu material, cómo desinstalar Video Maker por completo y otras dudas frecuentes.',
    bodyHtml,
  };
}
