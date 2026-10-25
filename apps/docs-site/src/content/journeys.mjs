import { pick } from '../i18n.mjs';

const PIPELINE_STAGES = {
  es: [
    {
      icon: 'script',
      title: 'Idea y guion',
      textHtml:
        'Le contás al productor qué video querés. Con Claude Code u OpenRouter arma o pule el guion, y vos lo aprobás antes de gastar un minuto de render.',
    },
    {
      icon: 'voice',
      title: 'Voz',
      textHtml:
        'La locución se sintetiza en tu Mac con voces Piper en español (es_AR, es_ES, es_MX) — o usás tu propia grabación. whisper.cpp la transcribe palabra por palabra.',
    },
    {
      icon: 'scenes',
      title: 'Escenas',
      textHtml:
        'En motion graphics la IA propone el storyboard y el estudio anima cada escena con tu marca. Con material crudo corta silencios, elige el B-roll por lo que se dice y suma subtítulos cinéticos.',
    },
    {
      icon: 'music',
      title: 'Música',
      textHtml:
        'Un tema de la marca, cortes al golpe y ducking automático: la música baja sola cuando habla la voz, con al menos 15 dB de margen.',
    },
    {
      icon: 'render',
      title: 'Render',
      textHtml:
        'Remotion o HyperFrames generan los cuadros, FFmpeg mezcla y masteriza a −14 LUFS, y una revisión automática controla niveles, cuadros negros y subtítulos antes de entregarte el MP4.',
    },
  ],
  en: [
    {
      icon: 'script',
      title: 'Idea & script',
      textHtml:
        'Tell the producer what video you want. With Claude Code or OpenRouter it drafts or polishes the script, and you approve it before a single minute of rendering.',
    },
    {
      icon: 'voice',
      title: 'Voice',
      textHtml:
        'The voice-over is synthesized on your Mac with Spanish Piper voices (es_AR, es_ES, es_MX) — or you use your own recording. whisper.cpp transcribes it word by word.',
    },
    {
      icon: 'scenes',
      title: 'Scenes',
      textHtml:
        'For motion graphics the AI proposes the storyboard and the studio animates every scene with your brand. With raw footage it trims silences, picks B-roll by what is being said and adds kinetic captions.',
    },
    {
      icon: 'music',
      title: 'Music',
      textHtml:
        'A brand track, cuts on the beat and automatic ducking: the music dips by itself whenever the voice speaks, with at least 15 dB of headroom.',
    },
    {
      icon: 'render',
      title: 'Render',
      textHtml:
        'Remotion or HyperFrames draw the frames, FFmpeg mixes and masters to −14 LUFS, and an automatic review checks levels, black frames and captions before handing you the MP4.',
    },
  ],
};

const PATHS = {
  es: [
    {
      id: 'camino-motion',
      icon: 'brand',
      tabLabel: 'Motion graphics',
      title: 'Motion graphics: del guion al video animado',
      introHtml:
        'No grabás nada. Escribís el guion, sumás unas fotos si querés, y el estudio diseña escenas animadas con tu marca, pone la voz y la música y corta al ritmo.',
      steps: [
        {
          kicker: 'Paso 1',
          title: 'Nuevo video → Motion graphics',
          bodyHtml: '<p>Desde "Tus videos" tocás "Nuevo video" y elegís el camino de motion graphics.</p>',
          screenshot: { file: 'create-mode.png', alt: 'Diálogo Nuevo video con las opciones Motion graphics y Material crudo' },
        },
        {
          kicker: 'Paso 2',
          title: 'Completá el brief',
          bodyHtml:
            '<p>Marca, formato (16:9 para YouTube o 9:16 para reels), música, objetivo, público y guion. Si sumás fotos, escribí en una línea qué muestra cada una: la IA elige por esa descripción.</p>',
          screenshot: { file: 'motion-brief.png', alt: 'Brief de motion graphics con marca, formato, música, título, objetivo, público y guion' },
        },
        {
          kicker: 'Paso 3',
          title: 'Storyboard y video',
          bodyHtml:
            '<p>"Armar storyboard" le pide a la IA las escenas; las revisás. "Hacer video" sintetiza la voz, prepara la música y renderiza mostrando el avance. El crédito de la música queda listo para la descripción.</p>',
          screenshot: { file: 'motion-video.png', alt: 'Video de motion graphics terminado en la página Motion, con el crédito de la música' },
        },
        {
          kicker: 'Paso 4',
          title: 'Ajustalo conversando',
          bodyHtml:
            '<p>"Ajustar con el productor": pedís "bajá la música" o "cambiá el título de la escena 3" y rehace sólo lo que cambió. Después lo publicás en YouTube desde la app.</p>',
          screenshot: { file: 'motion-adjust-chat.png', alt: 'Chat del productor en un video de motion graphics, con ejemplos de pedidos de ajuste' },
        },
      ],
    },
    {
      id: 'camino-material',
      icon: 'upload',
      tabLabel: 'Material crudo',
      title: 'Material crudo: tus grabaciones, montadas',
      introHtml:
        'Traés grabaciones de pantalla, cámara, fotos o música, y el productor arma el montaje: corta silencios, ubica el B-roll, subtitula y pone la locución.',
      steps: [
        {
          kicker: 'Paso 1',
          title: 'Nuevo video → Material crudo',
          bodyHtml: '<p>El mismo "Nuevo video", eligiendo el montaje de grabaciones.</p>',
          screenshot: { file: 'create-mode.png', alt: 'Diálogo Nuevo video con las opciones Motion graphics y Material crudo' },
        },
        {
          kicker: 'Paso 2',
          title: 'Soltá tus archivos',
          bodyHtml:
            '<p>Arrastrás el material sobre la conversación. Por cada archivo el productor propone un rol (A-roll, B-roll, imagen, música, logo) y vos confirmás.</p>',
          screenshot: { file: 'proposal-card.png', alt: 'Tarjeta de material recién subido con el rol propuesto B-roll y los botones Confirmar y Descartar' },
        },
        {
          kicker: 'Paso 3',
          title: 'Revisá el material',
          bodyHtml:
            '<p>La pestaña "Material" agrupa lo confirmado por categoría, con miniatura y duración. Si te falta metraje, el productor busca material libre en Wikimedia Commons y la NASA.</p>',
          screenshot: { file: 'material-tab.png', alt: 'Pestaña Material con miniaturas agrupadas por A-roll, B-roll, imágenes, música y logo' },
        },
        {
          kicker: 'Paso 4',
          title: 'Conversá y mirá la vista previa',
          bodyHtml:
            '<p>Elegís una receta (Tutorial, Tutorial vertical o Publicidad) o describís el video. El productor arma guion, cortes y voz, y la vista previa muestra el render apenas termina.</p>',
          screenshot: { file: 'workspace-preview.png', alt: 'Conversación con el productor y la vista previa de un render terminado' },
        },
        {
          kicker: 'Paso 5',
          title: 'Entregas y publicación',
          bodyHtml:
            '<p>Cada render confirmado queda en "Entregas" sin pisar los anteriores, listo para abrir en Finder o publicar en YouTube. Tus proyectos aparecen con su miniatura real.</p>',
          screenshot: { file: 'home-projects.png', alt: 'Tus videos: lista de proyectos con miniaturas reales y su estado' },
        },
      ],
    },
  ],
  en: [
    {
      id: 'path-motion',
      icon: 'brand',
      tabLabel: 'Motion graphics',
      title: 'Motion graphics: from script to animated video',
      introHtml:
        'Nothing to record. You write the script, add a few photos if you like, and the studio designs animated scenes with your brand, adds the voice and the music and cuts to the beat.',
      steps: [
        {
          kicker: 'Step 1',
          title: 'New video → Motion graphics',
          bodyHtml: '<p>From "Your videos" you tap "New video" and pick the motion graphics path.</p>',
          screenshot: { file: 'create-mode.png', alt: 'New video dialog with the Motion graphics and Raw footage options' },
        },
        {
          kicker: 'Step 2',
          title: 'Fill in the brief',
          bodyHtml:
            '<p>Brand, format (16:9 for YouTube or 9:16 for reels), music, goal, audience and script. If you add photos, write one line about what each one shows: the AI picks them by that description.</p>',
          screenshot: { file: 'motion-brief.png', alt: 'Motion graphics brief with brand, format, music, title, goal, audience and script' },
        },
        {
          kicker: 'Step 3',
          title: 'Storyboard and video',
          bodyHtml:
            '<p>"Build storyboard" asks the AI for the scenes; you review them. "Make video" synthesizes the voice, prepares the music and renders while showing progress. The music credit is ready for your description.</p>',
          screenshot: { file: 'motion-video.png', alt: 'Finished motion graphics video on the Motion page, with the music credit' },
        },
        {
          kicker: 'Step 4',
          title: 'Adjust it by chatting',
          bodyHtml:
            '<p>"Adjust with the producer": ask "lower the music" or "change the title of scene 3" and it redoes only what changed. Then publish it to YouTube from the app.</p>',
          screenshot: { file: 'motion-adjust-chat.png', alt: 'Producer chat on a motion graphics video, with sample adjustment requests' },
        },
      ],
    },
    {
      id: 'path-footage',
      icon: 'upload',
      tabLabel: 'Raw footage',
      title: 'Raw footage: your recordings, edited',
      introHtml:
        'Bring screen recordings, camera clips, photos or music, and the producer builds the edit: it trims silences, places B-roll, adds captions and the voice-over.',
      steps: [
        {
          kicker: 'Step 1',
          title: 'New video → Raw footage',
          bodyHtml: '<p>The same "New video", choosing the recordings edit.</p>',
          screenshot: { file: 'create-mode.png', alt: 'New video dialog with the Motion graphics and Raw footage options' },
        },
        {
          kicker: 'Step 2',
          title: 'Drop your files',
          bodyHtml:
            '<p>Drag your material onto the conversation. For each file the producer suggests a role (A-roll, B-roll, image, music, logo) and you confirm it.</p>',
          screenshot: { file: 'proposal-card.png', alt: 'Card for a freshly uploaded file with the suggested B-roll role and Confirm and Discard buttons' },
        },
        {
          kicker: 'Step 3',
          title: 'Review your material',
          bodyHtml:
            '<p>The "Material" tab groups everything confirmed by category, with thumbnail and duration. Missing footage? The producer finds freely licensed media on Wikimedia Commons and NASA.</p>',
          screenshot: { file: 'material-tab.png', alt: 'Material tab with thumbnails grouped by A-roll, B-roll, images, music and logo' },
        },
        {
          kicker: 'Step 4',
          title: 'Chat and watch the preview',
          bodyHtml:
            '<p>Pick a recipe (Tutorial, Vertical tutorial or Product ad) or just describe the video. The producer writes the script, the cuts and the voice, and the preview shows the render as soon as it finishes.</p>',
          screenshot: { file: 'workspace-preview.png', alt: 'Conversation with the producer and the preview of a finished render' },
        },
        {
          kicker: 'Step 5',
          title: 'Deliveries and publishing',
          bodyHtml:
            '<p>Every confirmed render lands in "Deliveries" without overwriting the previous ones, ready to open in Finder or publish to YouTube. Your projects show up with their real thumbnails.</p>',
          screenshot: { file: 'home-projects.png', alt: 'Your videos: project list with real thumbnails and their status' },
        },
      ],
    },
  ],
};

export function pipelineStages(locale) {
  return pick(locale, PIPELINE_STAGES);
}

export function creationPaths(locale) {
  return pick(locale, PATHS);
}
