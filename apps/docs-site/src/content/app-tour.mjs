import { escapeHtml, screenshotFigure } from '../render.mjs';
import { pageHref } from '../routes.mjs';

const GROUPS = {
  es: [
    {
      title: 'Producir',
      modules: [
        {
          id: 'mis-videos',
          shot: 'tour-mis-videos.jpg',
          title: 'Mis videos',
          alt: 'Página Mis videos con dos proyectos y sus miniaturas, agrupados por carpeta',
          text: 'Es la pantalla de inicio: todos tus videos, con su miniatura, el camino con el que se armaron y si ya tienen un video listo.',
          points: [
            'Buscás por título o por el nombre corto del video.',
            '«Nueva carpeta» agrupa videos por cliente o campaña, con categorías adentro.',
            '«Abrir» entra al video; el menú de cada tarjeta lo asigna a una carpeta, lo archiva o lo elimina.',
          ],
        },
        {
          id: 'nuevo-video',
          shot: 'tour-nuevo-video.jpg',
          title: 'Nuevo video',
          alt: 'Ventana Nuevo video con el nombre, el camino y la marca',
          text: 'Le ponés nombre, elegís el camino y, si querés, una marca. La marca después se puede cambiar.',
          points: [
            '<strong>Motion graphics</strong>: guion e imágenes, y el estudio anima las escenas.',
            '<strong>Material crudo</strong>: tus grabaciones, montadas, subtituladas y con locución.',
            '«Gestionar marcas» lleva a la página Marcas sin perder lo escrito.',
          ],
        },
      ],
    },
    {
      title: 'Dentro de un video',
      modules: [
        {
          id: 'productor',
          shot: 'tour-productor.jpg',
          title: 'Productor',
          alt: 'Chat con el productor con dos propuestas de producción y la vista previa del último render',
          text: 'Es el centro de cada video: le contás qué querés y el productor revisa el material, arma la propuesta, hace el montaje, renderiza y revisa el resultado.',
          points: [
            'Mientras trabaja muestra cada paso que da, en el idioma de la interfaz.',
            'Antes del render completo propone dos o tres enfoques (formato, duración, escenas, música); «Aprobar este enfoque» es tu OK.',
            'Debajo del chat elegís el modelo de IA del turno (por ejemplo Fable, Opus, Sonnet o Haiku) y adjuntás archivos.',
            'A la derecha queda la vista previa del último render y las pestañas Material y Entregas.',
          ],
        },
        {
          id: 'entregas',
          shot: 'tour-entregas.jpg',
          title: 'Entregas',
          alt: 'Pestaña Entregas con el video terminado listo para reproducir y descargar',
          text: 'Cada render terminado queda acá con su fecha, listo para mirar o descargar. Las versiones anteriores no se pisan.',
          points: ['El más reciente aparece primero.', '«Descargar» baja el MP4 final, con su mezcla a −14 LUFS.'],
        },
        {
          id: 'biblioteca',
          shot: 'tour-biblioteca.jpg',
          title: 'Biblioteca',
          alt: 'Biblioteca del video con el material agrupado por A-roll, B-roll, imágenes, música y logo',
          text: 'Todo el material del video, agrupado por el papel que cumple, con miniaturas y el estado de cada grupo.',
          points: [
            'Al subir elegís el rol: A-roll (material principal), B-roll (clips de apoyo), imágenes, música de fondo, tu locución o el logo.',
            '«Buscar material libre» trae clips, fotos y música con licencia libre y guarda su crédito.',
            'Al tocar un archivo se abre en el visor, con su rol, la revisión del productor y la descarga.',
          ],
        },
        {
          id: 'vista-previa',
          shot: 'tour-vista-previa.jpg',
          title: 'Vista previa y ajustes del render',
          alt: 'Vista previa del montaje con el panel de ajustes del render',
          text: 'El montaje se reproduce al instante, sin renderizar. A la derecha están los ajustes que el productor dejó y que podés tocar a mano.',
          points: [
            'Salida (YouTube 16:9 o vertical 9:16), logo, volumen de la música bajo la voz, clips, estilo de subtítulos y textos en pantalla.',
            '«Generar muestra (10 s)» renderiza un pedacito para ver el aspecto real antes del render completo.',
            'El historial guarda cada render con su estado.',
          ],
        },
      ],
    },
    {
      title: 'Videos de motion graphics',
      modules: [
        {
          id: 'motion',
          shot: 'tour-motion.jpg',
          title: 'Motion: el brief',
          alt: 'Brief de un video de motion graphics con marca, formato, música, guion e imágenes',
          text: 'Acá se cuenta el video: marca, formato, música, objetivo, público, guion y las imágenes que puede usar.',
          points: [
            'Cada imagen lleva una línea que dice qué muestra; el productor elige por esa descripción.',
            '«Sincronizar escenas con el golpe» corta al ritmo de la música.',
            '«Armar storyboard» y «Hacer video» siguen el camino solos; «Ajustar con el productor» vuelve al chat.',
          ],
        },
        {
          id: 'storyboard',
          shot: 'tour-storyboard.jpg',
          title: 'Storyboard',
          alt: 'Storyboard de un video de motion graphics con las escenas y sus textos',
          text: 'Las escenas que armó la IA, con sus textos, tiempos e imágenes. Revisarlas antes del video completo es barato.',
          points: ['Se edita a mano o pidiéndoselo al productor.', '«Regenerar video con los cambios» rehace el video con lo que corregiste.'],
        },
        {
          id: 'voz',
          shot: 'tour-voz.jpg',
          title: 'Voz',
          alt: 'Página Voz con cada línea del guion y su audio',
          text: 'Cada línea del guion con su audio para escucharla por separado.',
          points: ['La voz sale de la marca o de la configuración: voces locales en español o ElevenLabs.', 'El productor puede cambiar el ritmo o el tono de una línea sin rehacer las demás.'],
        },
        {
          id: 'vista-previa-motion',
          shot: 'tour-motion-preview.jpg',
          title: 'Vista previa del video animado',
          alt: 'Video de motion graphics terminado con los créditos para la descripción y la lista de escenas',
          text: 'El video renderizado, con los créditos listos para pegar en la descripción y la lista de escenas con sus tiempos.',
          points: ['«Revisar de nuevo» repite la revisión automática de audio e imagen.', '«Publicar en YouTube» lo suma a la cola de publicación.'],
        },
      ],
    },
    {
      title: 'Marcas',
      modules: [
        {
          id: 'marcas',
          shot: 'tour-marcas.jpg',
          title: 'Marcas',
          alt: 'Página Marcas con la marca Video Maker y una marca incluida',
          text: 'Tus marcas y las que trae el estudio. Una marca se arma una vez y se usa en todos los videos.',
          points: ['«Duplicar» parte de una marca existente.', 'Las marcas incluidas se pueden ver y duplicar, pero no editar.'],
        },
        {
          id: 'editor-de-marca',
          shot: 'tour-editor-marca.jpg',
          title: 'Editor de marca',
          alt: 'Editor de la marca Video Maker con sus secciones y la vista previa en vivo',
          text: 'Identidad, logo, colores, tipografías, voz, música, fotos y productos, con una vista previa que se actualiza al instante.',
          points: ['El nombre hablado le dice a la voz cómo pronunciar la marca.', 'Las fotos y los productos quedan a mano para cualquier video de esa marca.'],
        },
      ],
    },
    {
      title: 'Publicación',
      modules: [
        {
          id: 'publicacion',
          shot: 'tour-publicacion.jpg',
          title: 'Cola de YouTube',
          alt: 'Página Publicación con la cola, los publicados y el límite diario',
          text: 'Los videos que mandaste a YouTube salen de a uno, respetando un límite diario. La cola se puede pausar y reordenar.',
          points: ['Pestañas Cola, Publicados y Con error.', 'El título, la descripción y los créditos los propone el productor; vos los revisás antes de encolar.'],
        },
      ],
    },
    {
      title: 'Configuración',
      modules: [
        {
          id: 'config-productor',
          shot: 'tour-config-productor.jpg',
          title: 'Productor',
          alt: 'Configuración del productor con el motor, el modelo de Claude y la key de OpenRouter',
          text: 'Qué motor de IA usa el productor: Claude Code con tu suscripción u OpenRouter con tu key, y el modelo por defecto de cada uno.',
          points: ['La key se guarda en tu Mac y no vuelve a mostrarse completa.', 'Los modelos de OpenRouter se filtran entre recomendados y todos.'],
        },
        {
          id: 'config-voz',
          shot: 'tour-config-voz.jpg',
          title: 'Voz, YouTube y apariencia',
          alt: 'Configuración de voces de ElevenLabs con una voz agregada',
          text: 'Las voces de ElevenLabs que querés tener a mano, la conexión con tu canal de YouTube y el aspecto de la app.',
          points: ['Las voces se agregan por su ID de ElevenLabs y un nombre.', 'Apariencia: tema claro, oscuro o del sistema, y material vidrio o sólido.'],
        },
        {
          id: 'agentes',
          shot: 'tour-config-agentes.jpg',
          title: 'Agentes',
          alt: 'Configuración de agentes con los pasos para Claude Code, GitHub Copilot y Gemini CLI',
          text: 'Cómo conectar tu agente de código al estudio: desde tu proyecto le pedís un video y el agente arma la marca y el material.',
          points: ['Pasos y comandos para Claude Code, GitHub Copilot, Gemini CLI y cualquier cliente MCP.', 'Publicar y borrar siempre lo hacés vos desde el estudio.'],
        },
      ],
    },
    {
      title: 'Ayuda',
      modules: [
        {
          id: 'aprender',
          shot: 'tour-aprender.jpg',
          title: 'Aprender',
          alt: 'Página Aprender con la guía de uso paso a paso',
          text: 'La guía de uso dentro de la app, sin conexión: guía paso a paso, cómo funciona, el tutorial en video, preguntas frecuentes y una galería de capturas.',
          points: [],
        },
        {
          id: 'acerca-de',
          shot: 'tour-acerca-de.jpg',
          title: 'Acerca de',
          alt: 'Página Acerca de con la versión instalada y Buscar actualizaciones',
          text: 'La versión instalada, «Buscar actualizaciones», los requisitos, las licencias, el código abierto y la privacidad.',
          points: [],
        },
      ],
    },
  ],
  en: [
    {
      title: 'Produce',
      modules: [
        {
          id: 'my-videos',
          shot: 'tour-mis-videos.jpg',
          title: 'My videos',
          alt: 'My videos page with two projects and their thumbnails, grouped by folder',
          text: 'The home screen: all your videos, with their thumbnail, the path they were built with and whether a finished video is ready.',
          points: [
            'Search by title or by the video’s short name.',
            '“New folder” groups videos by client or campaign, with categories inside.',
            '“Open” enters the video; each card’s menu assigns it to a folder, archives it or deletes it.',
          ],
        },
        {
          id: 'new-video',
          shot: 'tour-nuevo-video.jpg',
          title: 'New video',
          alt: 'New video dialog with the name, the path and the brand',
          text: 'Name it, pick the path and, optionally, a brand. The brand can be changed later.',
          points: [
            '<strong>Motion graphics</strong>: script and images, and the studio animates the scenes.',
            '<strong>Raw footage</strong>: your recordings, edited, captioned and voiced.',
            '“Manage brands” opens the Brands page without losing what you typed.',
          ],
        },
      ],
    },
    {
      title: 'Inside a video',
      modules: [
        {
          id: 'producer',
          shot: 'tour-productor.jpg',
          title: 'Producer',
          alt: 'Chat with the producer showing two production proposals and the preview of the latest render',
          text: 'The heart of every video: tell it what you want and the producer reviews the material, writes the proposal, edits, renders and reviews the result.',
          points: [
            'While it works it shows every step it takes, in the interface language.',
            'Before the full render it proposes two or three approaches (format, length, scenes, music); “Approve this approach” is your OK.',
            'Below the chat you pick the AI model for the turn (for example Fable, Opus, Sonnet or Haiku) and attach files.',
            'On the right: the preview of the latest render and the Material and Deliveries tabs.',
          ],
        },
        {
          id: 'deliveries',
          shot: 'tour-entregas.jpg',
          title: 'Deliveries',
          alt: 'Deliveries tab with the finished video ready to play and download',
          text: 'Every finished render stays here with its date, ready to watch or download. Earlier versions are kept.',
          points: ['The latest one comes first.', '“Download” saves the final MP4, mixed at −14 LUFS.'],
        },
        {
          id: 'library',
          shot: 'tour-biblioteca.jpg',
          title: 'Library',
          alt: 'Video library with the material grouped by A-roll, B-roll, images, music and logo',
          text: 'All the video’s material, grouped by the role it plays, with thumbnails and the status of each group.',
          points: [
            'When uploading you pick the role: A-roll (main footage), B-roll (supporting clips), images, background music, your voice-over or the logo.',
            '“Find free material” brings clips, photos and music under free licenses and keeps their credit.',
            'Click a file to open it in the viewer, with its role, the producer’s review and a download.',
          ],
        },
        {
          id: 'preview',
          shot: 'tour-vista-previa.jpg',
          title: 'Preview and render settings',
          alt: 'Preview of the edit with the render settings panel',
          text: 'The edit plays instantly, with no render. On the right are the settings the producer chose, which you can change by hand.',
          points: [
            'Output (YouTube 16:9 or vertical 9:16), logo, music level under the voice, clips, caption style and on-screen text.',
            '“Generate sample (10 s)” renders a short piece to see the real look before the full render.',
            'The history keeps every render with its status.',
          ],
        },
      ],
    },
    {
      title: 'Motion graphics videos',
      modules: [
        {
          id: 'motion',
          shot: 'tour-motion.jpg',
          title: 'Motion: the brief',
          alt: 'Brief of a motion graphics video with brand, format, music, script and images',
          text: 'Where you describe the video: brand, format, music, goal, audience, script and the images it may use.',
          points: [
            'Each image carries one line saying what it shows; the producer picks by that description.',
            '“Sync scenes to the beat” cuts to the music.',
            '“Build storyboard” and “Make video” run the path on their own; “Adjust with the producer” goes back to the chat.',
          ],
        },
        {
          id: 'storyboard',
          shot: 'tour-storyboard.jpg',
          title: 'Storyboard',
          alt: 'Storyboard of a motion graphics video with its scenes and texts',
          text: 'The scenes the AI built, with their text, timing and images. Reviewing them before the full video is cheap.',
          points: ['Edit by hand or ask the producer.', '“Regenerate video with the changes” remakes the video with your corrections.'],
        },
        {
          id: 'voice',
          shot: 'tour-voz.jpg',
          title: 'Voice',
          alt: 'Voice page with every script line and its audio',
          text: 'Every script line with its own audio to listen to separately.',
          points: ['The voice comes from the brand or the settings: local Spanish voices or ElevenLabs.', 'The producer can change the pace or tone of one line without redoing the rest.'],
        },
        {
          id: 'motion-preview',
          shot: 'tour-motion-preview.jpg',
          title: 'Preview of the animated video',
          alt: 'Finished motion graphics video with the credits for the description and the list of scenes',
          text: 'The rendered video, with the credits ready to paste into the description and the list of scenes with their timing.',
          points: ['“Review again” repeats the automatic audio and image review.', '“Publish to YouTube” adds it to the publishing queue.'],
        },
      ],
    },
    {
      title: 'Brands',
      modules: [
        {
          id: 'brands',
          shot: 'tour-marcas.jpg',
          title: 'Brands',
          alt: 'Brands page with the Video Maker brand and a built-in brand',
          text: 'Your brands and the ones the studio ships with. A brand is built once and used in every video.',
          points: ['“Duplicate” starts from an existing brand.', 'Built-in brands can be viewed and duplicated, not edited.'],
        },
        {
          id: 'brand-editor',
          shot: 'tour-editor-marca.jpg',
          title: 'Brand editor',
          alt: 'Editor of the Video Maker brand with its sections and the live preview',
          text: 'Identity, logo, colors, fonts, voice, music, photos and products, with a preview that updates instantly.',
          points: ['The spoken name tells the voice how to pronounce the brand.', 'Photos and products stay at hand for any video of that brand.'],
        },
      ],
    },
    {
      title: 'Publishing',
      modules: [
        {
          id: 'publishing',
          shot: 'tour-publicacion.jpg',
          title: 'YouTube queue',
          alt: 'Publishing page with the queue, the published videos and the daily limit',
          text: 'Videos you send to YouTube go out one at a time, within a daily limit. The queue can be paused and reordered.',
          points: ['Queue, Published and Failed tabs.', 'The producer proposes the title, description and credits; you review them before queueing.'],
        },
      ],
    },
    {
      title: 'Settings',
      modules: [
        {
          id: 'settings-producer',
          shot: 'tour-config-productor.jpg',
          title: 'Producer',
          alt: 'Producer settings with the engine, the Claude model and the OpenRouter key',
          text: 'Which AI engine the producer uses: Claude Code with your subscription or OpenRouter with your key, and each one’s default model.',
          points: ['The key is stored on your Mac and never shown in full again.', 'OpenRouter models are filtered between recommended and all.'],
        },
        {
          id: 'settings-voice',
          shot: 'tour-config-voz.jpg',
          title: 'Voice, YouTube and appearance',
          alt: 'ElevenLabs voice settings with one voice added',
          text: 'The ElevenLabs voices you want at hand, the connection to your YouTube channel and the look of the app.',
          points: ['Voices are added by their ElevenLabs ID and a name.', 'Appearance: light, dark or system theme, and glass or solid material.'],
        },
        {
          id: 'agents',
          shot: 'tour-config-agentes.jpg',
          title: 'Agents',
          alt: 'Agents settings with the steps for Claude Code, GitHub Copilot and Gemini CLI',
          text: 'How to connect your coding agent to the studio: ask for a video from your project and the agent prepares the brand and the material.',
          points: ['Steps and commands for Claude Code, GitHub Copilot, Gemini CLI and any MCP client.', 'Publishing and deleting are always yours, from the studio.'],
        },
      ],
    },
    {
      title: 'Help',
      modules: [
        {
          id: 'learn',
          shot: 'tour-aprender.jpg',
          title: 'Learn',
          alt: 'Learn page with the step-by-step guide',
          text: 'The user guide inside the app, offline: step-by-step guide, how it works, the video tutorial, FAQ and a gallery of screenshots.',
          points: [],
        },
        {
          id: 'about',
          shot: 'tour-acerca-de.jpg',
          title: 'About',
          alt: 'About page with the installed version and Check for updates',
          text: 'The installed version, “Check for updates”, requirements, licenses, open source and privacy.',
          points: [],
        },
      ],
    },
  ],
};

const INTRO = {
  es: {
    title: 'Recorrido por la app',
    description: 'Cada pantalla de Video Maker con su captura: videos, productor, biblioteca, motion graphics, marcas, publicación y configuración.',
    lede: 'Cada pantalla del estudio, con una captura real y qué se hace en ella. Para el paso a paso de un video completo, mirá',
    ledeLink: 'Usar el estudio',
    indexLabel: 'En esta página',
  },
  en: {
    title: 'App tour',
    description: 'Every Video Maker screen with its screenshot: videos, producer, library, motion graphics, brands, publishing and settings.',
    lede: 'Every screen of the studio, with a real screenshot and what you do there. For the step-by-step of a whole video, see',
    ledeLink: 'Using the studio',
    indexLabel: 'On this page',
  },
};

function moduleSection(ctx, module) {
  const points = module.points.length === 0 ? '' : `<ul>${module.points.map((point) => `<li>${point}</li>`).join('')}</ul>`;
  return `<h3 id="${module.id}">${escapeHtml(module.title)}</h3>
<p>${escapeHtml(module.text)}</p>
${points}
${screenshotFigure(ctx, module.shot, module.alt)}`;
}

function tableOfContents(groups, label) {
  const items = groups
    .map((group) => `<li><strong>${escapeHtml(group.title)}</strong>: ${group.modules.map((module) => `<a href="#${module.id}">${escapeHtml(module.title)}</a>`).join(' · ')}</li>`)
    .join('');
  return `<nav aria-label="${escapeHtml(label)}"><ul>${items}</ul></nav>`;
}

export function renderPage(ctx) {
  const intro = INTRO[ctx.locale];
  const groups = GROUPS[ctx.locale];
  const sections = groups.map((group) => `<h2>${escapeHtml(group.title)}</h2>\n${group.modules.map((module) => moduleSection(ctx, module)).join('\n')}`).join('\n');
  const bodyHtml = `
<h1>${escapeHtml(intro.title)}</h1>
<p class="lede">${escapeHtml(intro.lede)} <a href="${pageHref(ctx, 'using-studio')}">${escapeHtml(intro.ledeLink)}</a>.</p>
${tableOfContents(groups, intro.indexLabel)}
${sections}
`;
  return { title: intro.title, description: intro.description, bodyHtml };
}
