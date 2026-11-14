import type { LearnContent } from './learn-content';

export const LEARN_ES: LearnContent = {
  howItWorks: {
    title: 'Cómo funciona Video Maker',
    lede: 'De la idea al MP4 en cinco etapas. Abajo, el recorrido por cada camino con capturas reales del estudio.',
    pipelineTitle: 'El pipeline',
    stages: [
      {
        id: 'script',
        title: 'Idea y guion',
        text: 'Le contás al productor qué video querés. Con Claude Code u OpenRouter arma o pule el guion, y vos lo aprobás antes de gastar un minuto de render.',
      },
      {
        id: 'voice',
        title: 'Voz',
        text: 'La locución se sintetiza en tu Mac con voces Piper en español (es_AR, es_ES, es_MX), o usás tu propia grabación. whisper.cpp la transcribe palabra por palabra.',
      },
      {
        id: 'scenes',
        title: 'Escenas',
        text: 'En motion graphics la IA propone el storyboard y el estudio anima cada escena con tu marca. Con material crudo corta silencios, elige el B-roll por lo que se dice y suma subtítulos cinéticos.',
      },
      {
        id: 'music',
        title: 'Música',
        text: 'Un tema de la marca, cortes al golpe y ducking automático: la música baja sola cuando habla la voz, con al menos 15 dB de margen.',
      },
      {
        id: 'render',
        title: 'Render',
        text: 'Remotion o HyperFrames generan los cuadros, FFmpeg mezcla y masteriza a −14 LUFS, y una revisión automática controla niveles, cuadros negros y subtítulos antes de entregarte el MP4.',
      },
    ],
    pathsTitle: 'Los dos caminos, paso a paso',
    pathsLede: 'Elegí un camino y recorré sus pasos. Tocá una captura para verla ampliada.',
    paths: [
      {
        id: 'motion',
        tabLabel: 'Motion graphics',
        title: 'Motion graphics: del guion al video animado',
        intro:
          'No grabás nada. Escribís el guion, sumás unas fotos si querés, y el estudio diseña escenas animadas con tu marca, pone la voz y la música y corta al ritmo.',
        steps: [
          {
            title: 'Nuevo video → Motion graphics',
            text: 'Desde «Mis videos» tocás «Nuevo video» y elegís el camino de motion graphics.',
            screenshot: { file: 'create-mode.png', alt: 'Diálogo Nuevo video con las opciones Motion graphics y Material crudo' },
          },
          {
            title: 'Completá el brief',
            text: 'Marca, formato (16:9 para YouTube o 9:16 para reels), música, objetivo, público y guion. Si sumás fotos, escribí en una línea qué muestra cada una: la IA elige por esa descripción.',
            screenshot: { file: 'motion-brief.png', alt: 'Brief de motion graphics con marca, formato, música, título, objetivo, público y guion' },
          },
          {
            title: 'Storyboard y video',
            text: '«Armar storyboard» le pide a la IA las escenas; las revisás. «Hacer video» sintetiza la voz, prepara la música y renderiza mostrando el avance. El crédito de la música queda listo para la descripción.',
            screenshot: { file: 'motion-video.png', alt: 'Video de motion graphics terminado en la página Motion, con el crédito de la música' },
          },
          {
            title: 'Ajustalo conversando',
            text: '«Ajustar con el productor»: pedís «bajá la música» o «cambiá el título de la escena 3» y rehace solo lo que cambió. Después lo publicás en YouTube desde la app.',
            screenshot: { file: 'motion-adjust-chat.png', alt: 'Chat del productor en un video de motion graphics, con ejemplos de pedidos de ajuste' },
          },
        ],
      },
      {
        id: 'footage',
        tabLabel: 'Material crudo',
        title: 'Material crudo: tus grabaciones, montadas',
        intro:
          'Traés grabaciones de pantalla, cámara, fotos o música, y el productor arma el montaje: corta silencios, ubica el B-roll, subtitula y pone la locución.',
        steps: [
          {
            title: 'Nuevo video → Material crudo',
            text: 'El mismo «Nuevo video», eligiendo el montaje de grabaciones.',
            screenshot: { file: 'create-mode.png', alt: 'Diálogo Nuevo video con las opciones Motion graphics y Material crudo' },
          },
          {
            title: 'Soltá tus archivos',
            text: 'Arrastrás el material sobre la conversación. Por cada archivo el productor propone un rol (A-roll, B-roll, imagen, música, logo) y vos confirmás.',
            screenshot: { file: 'proposal-card.png', alt: 'Tarjeta de material recién subido con el rol propuesto B-roll y los botones Confirmar y Descartar' },
          },
          {
            title: 'Revisá el material',
            text: 'La pestaña «Material» agrupa lo confirmado por categoría, con miniatura y duración. Si te falta metraje, el productor busca material libre en Wikimedia Commons y la NASA.',
            screenshot: { file: 'material-tab.png', alt: 'Pestaña Material con miniaturas agrupadas por A-roll, B-roll, imágenes, música y logo' },
          },
          {
            title: 'Conversá y mirá la vista previa',
            text: 'Elegís una receta (Tutorial, Tutorial vertical o Publicidad) o describís el video. El productor arma guion, cortes y voz, y la vista previa muestra el render apenas termina.',
            screenshot: { file: 'workspace-preview.png', alt: 'Conversación con el productor y la vista previa de un render terminado' },
          },
          {
            title: 'Entregas y publicación',
            text: 'Cada render confirmado queda en «Entregas» sin pisar los anteriores, listo para abrir en Finder o publicar en YouTube. Tus proyectos aparecen con su miniatura real.',
            screenshot: { file: 'home-projects.png', alt: 'Mis videos: lista de proyectos agrupados por carpeta, con miniaturas reales y su estado' },
          },
        ],
      },
    ],
    whereTitle: 'Qué corre dónde',
    whereHeaders: ['Etapa', 'Dónde corre', 'Con qué'],
    whereRows: [
      { stage: 'Conversación, guion y storyboard', where: 'En la IA que conectaste', with: 'Claude Code (tu suscripción) u OpenRouter (tu key)' },
      { stage: 'Transcripción', where: 'En tu Mac', with: 'whisper.cpp con el modelo large-v3-turbo' },
      { stage: 'Voz', where: 'En tu Mac', with: 'Voces Piper con sherpa-onnx (opcional: ElevenLabs con tu key)' },
      { stage: 'Escenas y render', where: 'En tu Mac', with: 'Remotion + Chrome headless (material crudo) · HyperFrames + GSAP (motion graphics)' },
      { stage: 'Mezcla, máster y revisión', where: 'En tu Mac', with: 'FFmpeg / ffprobe' },
      { stage: 'Publicación', where: 'En tu canal', with: 'YouTube Data API v3, solo si conectás tu cuenta' },
    ],
  },
  tutorial: {
    title: 'De la marca al video, en poco más de dos minutos',
    lede: 'Un recorrido real por el estudio: se crea una marca, se adjuntan las fotos, el productor arma el video y se publica. Las esperas del productor van aceleradas.',
    credit: 'Voz: Malena · Música: Inspiring Advertising - Upbeat Summer Corporate, Rafael Krux, CC BY 4.0',
  },
  faq: {
    title: 'Preguntas frecuentes',
    entries: [
      {
        id: 'where-material',
        question: '¿Dónde vive mi material y mis videos?',
        answer:
          'Por defecto, en una carpeta dentro de `~/Library/Application Support/Video Maker`: la elegís (o confirmás) en el primer arranque y la podés cambiar después desde el menú de la app («Preferencias» → «Carpeta de proyectos…»). Cada proyecto es una carpeta con tu material crudo, lo que produce el productor y los renders finales.',
      },
      {
        id: 'logs',
        question: '¿Dónde están los logs si algo falla?',
        answer:
          'Desde el menú de la app: «Ayuda» → «Abrir carpeta de logs». Ahí vive el log del servicio local que hace el trabajo pesado (transcripción, render, etc.), útil para reportar un problema.',
      },
      {
        id: 'uninstall',
        question: '¿Cómo la desinstalo por completo?',
        answer:
          'Tres pasos: (1) arrastrá «Video Maker» desde Aplicaciones a la Papelera; (2) si cargaste una key de OpenRouter, abrí «Acceso a Llaveros», buscá el ítem **Video Maker** y borralo; (3) si querés borrar también tus proyectos y los modelos descargados, borrá la carpeta `~/Library/Application Support/Video Maker` completa. Hacelo solo si no te importa perder tus videos y su material.',
      },
      {
        id: 'update',
        question: '¿Cómo actualizo a una versión nueva?',
        answer:
          'Bajá el .dmg más nuevo desde la página de descarga y arrastralo de nuevo a Aplicaciones, reemplazando la versión anterior. No hay auto-actualización (la firma ad hoc de Electron no la permite en macOS). Tus proyectos y tu configuración no se tocan: viven aparte de la app.',
      },
      {
        id: 'privacy',
        question: '¿Sale algo de mi material a internet?',
        answer:
          'No. La transcripción, la generación de voz y el render final corren con binarios instalados localmente (ffmpeg, whisper.cpp, sherpa-onnx, Remotion, HyperFrames). Lo que sale de tu máquina es el texto de la conversación con el productor, hacia Claude o hacia OpenRouter según cuál hayas conectado y, solo si los usás, el texto de la locución hacia ElevenLabs y el video que elegís publicar hacia YouTube.',
      },
      {
        id: 'open-source',
        question: '¿El código es abierto?',
        answer:
          'Sí, con licencia MIT. El repositorio está en https://github.com/e-burgos/video-maker, con cómo correrlo y cómo contribuir.',
      },
      {
        id: 'music-credit',
        question: '¿Por qué el video no muestra el crédito de la música?',
        answer:
          'Porque queda mejor en la descripción. Los temas de la marca son de Kevin MacLeod con licencia CC BY 4.0, que pide nombrar al autor: el texto exacto aparece debajo del reproductor en la página Motion y en `out/video.credits.txt` de cada proyecto. Pegalo en la descripción cada vez que publiques el video.',
      },
      {
        id: 'motion-needs',
        question: '¿Qué necesito para un video de motion graphics?',
        answer:
          'Un guion y, si querés, unas fotos con una línea que diga qué muestran. La IA arma el storyboard con el motor que tengas conectado (Claude con tu suscripción u OpenRouter); la voz, la música y el render corren en tu Mac. Un video de un minuto tarda unos minutos en el storyboard y otros cinco a diez en voz y render.',
      },
      {
        id: 'motion-change',
        question: '¿Cómo cambio algo de un video de motion graphics que ya hice?',
        answer:
          'Abrí el video, tocá «Ajustar con el productor» y pedí el cambio en tus palabras (la música, un texto, una frase de la voz, el orden de las escenas). El productor edita solo esas escenas y rehace el video; la voz se vuelve a grabar únicamente donde cambió el texto, así que un ajuste chico tarda uno o dos minutos.',
      },
      {
        id: 'storyboard-engine',
        question: '¿El storyboard funciona sin Claude?',
        answer:
          'Sí. El storyboard (la propuesta de escenas del video: qué se dice y qué se ve en cada una) se genera con el motor de IA que tengas conectado en Configuración, Claude Code u OpenRouter. No hace falta tener Claude para usarlo: alcanza con cualquiera de los dos.',
      },
    ],
  },
  gallery: {
    title: 'Capturas reales del estudio',
    lede: 'Tocá una captura para verla ampliada y recorré el resto con las flechas.',
    shots: [
      { file: 'home-projects.png', caption: 'Mis videos: lista de proyectos agrupados por carpeta, con miniaturas reales y su estado' },
      { file: 'motion-video.png', caption: 'Un video de motion graphics terminado, con el crédito de la música para la descripción' },
      { file: 'workspace-preview.png', caption: 'Conversación con el productor y la vista previa de un render terminado' },
      { file: 'proposal-card.png', caption: 'Al soltar un archivo, el productor propone un rol para confirmar o descartar' },
      { file: 'create-mode.png', caption: 'Diálogo Nuevo video con las opciones Motion graphics y Material crudo' },
      { file: 'motion-brief.png', caption: 'Brief de motion graphics con marca, formato, música, título, objetivo, público y guion' },
      { file: 'material-tab.png', caption: 'Pestaña Material con miniaturas agrupadas por A-roll, B-roll, imágenes, música y logo' },
      { file: 'motion-adjust-chat.png', caption: 'Chat del productor en un video de motion graphics, con ejemplos de pedidos de ajuste' },
      { file: 'settings-openrouter.png', caption: 'Configuración: conexión del productor con OpenRouter' },
    ],
  },
};
