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
