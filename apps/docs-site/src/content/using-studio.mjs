import { screenshotFigure } from '../render.mjs';

function bodyEs(ctx) {
  return `
<h1>Usar el estudio</h1>
<p class="lede">
Cada video vive en su propio proyecto, con su material y su conversación con el productor.
</p>

<h2>Dos caminos: motion graphics o material crudo</h2>
<p>
Al tocar "Nuevo video" elegís cómo armarlo. <strong>Motion graphics</strong>: no grabás nada,
escribís el guion y el estudio diseña escenas animadas con la marca (títulos, equipos con su
pantalla, celulares, tableros, fotos), pone la voz, elige la música y corta al ritmo.
<strong>Material crudo</strong>: el montaje de tus grabaciones de siempre, con el productor.
</p>
${screenshotFigure(ctx, 'create-mode.png', 'Nuevo video: elegir entre Motion graphics (guion e imágenes) y Material crudo (montaje de grabaciones)')}

<h2>Videos de motion graphics</h2>
<p>
Cada video de motion graphics tiene su página <strong>Motion</strong>. Ahí completás el brief: la
marca, el formato (horizontal 16:9 o vertical 9:16 para reels), la música (automática, un tema de
la marca o sin música), el objetivo, el público y el guion. Si sumás fotos, escribí en una línea qué
muestra cada una: la IA no las ve, elige por esa descripción.
</p>
${screenshotFigure(ctx, 'motion-brief.png', 'Brief de un video de motion graphics: marca, formato, música, título, objetivo, público y guion')}
<p>
"Armar storyboard" le pide a la IA las escenas (tarda unos minutos); revisalas antes de seguir,
porque cambiar el guion y volver a armarlas es barato. "Hacer video" sintetiza la voz, prepara la
música y renderiza, mostrando el avance. El video queda en el proyecto y se ve cada vez que abrís la
página. También se lo podés pedir al productor en la conversación.
</p>
${screenshotFigure(ctx, 'motion-video.png', 'Video terminado en la página Motion, con el crédito de la música para la descripción')}
<h2>Marcas: tu identidad en cada video</h2>
<p>
El acceso <strong>Marcas</strong> del encabezado lista las marcas incluidas y las tuyas. Con
"Nueva marca" armás una desde cero; con "Duplicar" partís de una existente (las incluidas son de
solo lectura). El editor tiene una sección por tema — identidad, logo, colores, tipografías (también
de Google Fonts, que se descargan dentro de la marca), voz, música, fotos y productos — y una vista
previa en vivo con la apertura y el cierre: los colores se actualizan al instante y el logo o las
tipografías recomponen la vista. Una marca borrada pasa a <code>brands/.trash</code>, no se pierde.
</p>
<h2>Ajustar un video de motion graphics conversando</h2>
<p>
Desde la página Motion, el botón <strong>"Ajustar con el productor"</strong> abre el chat de ese video.
Pedile los cambios en tus palabras — "bajá la música", "cambiá el título de la escena 3", "acortá la
voz del cierre", "sacá la escena del Wi-Fi" — y el productor edita esas escenas, te cuenta qué cambió y
rehace el video. Nunca vuelve a armar el storyboard desde cero para un ajuste, así que lo que ya
estaba bien queda igual.
</p>
${screenshotFigure(ctx, 'motion-adjust-chat.png', 'Chat del productor en un video de motion graphics, con ejemplos de pedidos para ajustarlo')}
<p>
Rehacer un video ajustado es rápido: solo se vuelve a grabar la voz de las escenas cuyo texto
cambiaste (bajar la música de un video de un minuto lleva un minuto y medio). Cada video tiene su
propio volumen de música; si suena alta, pedile que la baje.
</p>
<p>
La música de la marca es de Kevin MacLeod con licencia CC BY: el crédito no se dibuja sobre el
video, aparece debajo del reproductor (y en <code>out/video.credits.txt</code>) para que lo pegues
en la descripción de la publicación — la licencia lo pide.
</p>

<h2>Subir material</h2>
<p>
Arrastrá tus archivos (grabaciones, cámara, fotos, música, logo) directo sobre la zona de
conversación, o usá el botón "Adjuntar archivos". Por cada archivo, el productor propone un rol
según lo que detecta — tiene voz, no tiene audio, tiene transparencia, es una foto, su nombre
menciona música — y vos confirmás o cambiás el rol antes de que se guarde.
</p>
${screenshotFigure(ctx, 'proposal-card.png', 'Tarjeta de material recién subido con el rol propuesto (B-roll) y los botones Confirmar / Descartar')}
<p>
El productor también puede mirar las fotos que subiste — le sirve, por ejemplo, para armar
mejor la receta Publicidad a partir de tus propias imágenes.
</p>

<h2>Material libre para B-roll</h2>
<p>
Si te falta metraje, se lo podés pedir directo al productor: contale algo como "buscá material
libre sobre bicicletas urbanas" y te va a traer opciones de video y fotos de Wikimedia Commons
y de la biblioteca de NASA — solo con licencias libres para uso comercial. Elegís la que te
sirve y queda importada como cualquier otro archivo de tu material.
</p>
<p>
El crédito de cada archivo que importás así (autor, fuente, licencia) se guarda solo en el
archivo de créditos del proyecto — incluilo en la descripción del video cuando lo publiques.
</p>

<h2>Recetas (material crudo)</h2>
<p>
Son plantillas de video ya afinadas: le contás al productor cuál querés usar (o simplemente
describís qué necesitás y él elige) y arma el guion, el corte y la locución siguiendo esa receta.
Vienen tres de fábrica: <strong>Tutorial</strong> (pantalla grabada con narración sincronizada,
subtítulos, música suave y logo), <strong>Tutorial vertical</strong> (la misma receta en 9:16 para
Reels/TikTok/Shorts) y <strong>Publicidad</strong> (spot corto en 9:16 armado a partir de fotos).
</p>

<h2>La pestaña Material</h2>
<p>
Al lado de la conversación, la pestaña "Material" agrupa todo lo confirmado por categoría
(A-roll, B-roll, imágenes, música, logo) con una miniatura y la duración de cada archivo — para
ver de un vistazo con qué está trabajando el productor.
</p>
${screenshotFigure(ctx, 'material-tab.png', 'Pestaña Material de un proyecto, con miniaturas agrupadas por A-roll, B-roll, imágenes, música y logo')}

<h2>Vista previa y Entregas</h2>
<p>
Mientras el productor trabaja, la pestaña "Vista previa" muestra el render más reciente apenas
termina. Cuando lo confirmás, queda también en "Entregas", listo para reproducir o abrir en
Finder — los renders anteriores quedan ahí también, no se pisan entre sí.
</p>
${screenshotFigure(ctx, 'workspace-preview.png', 'Conversación con el productor y, a la derecha, la vista previa de un render ya terminado')}

<h2>Publicar en YouTube</h2>
<p>
El estudio sube el video terminado a tu canal sin salir de la app. La conexión se hace una sola vez,
en <strong>Configuración › YouTube</strong>, con una credencial propia de Google: en Google Cloud
creás un proyecto, habilitás la <strong>YouTube Data API v3</strong> y creás un cliente OAuth de tipo
"Aplicación de escritorio". Pegás el ID de cliente y el secreto, tocás "Conectar con YouTube", permitís
el acceso en la ventana de Google y volvés: el canal aparece con su nombre y su foto.
</p>
<p>
Después, el botón <strong>"Publicar en YouTube"</strong> (en la vista previa, en Entregas o en la página
Motion) abre un diálogo: elegís el MP4, tocás "Proponer con el productor" para que escriba título,
descripción (con el crédito de la música) y etiquetas, y los editás a gusto. Elegís la visibilidad
(público, oculto o privado) o programás una fecha — un video programado se sube como privado y YouTube lo
publica a esa hora. Antes de publicar en público el estudio te pide confirmar en qué canal sale. La subida
muestra su avance, se puede cancelar o reintentar, y cada video publicado queda registrado en el proyecto
con su enlace.
</p>

<h2>Edición avanzada</h2>
<p>
Para cuando querés meter mano vos mismo: la biblioteca de material, el storyboard (guion y cortes
palabra por palabra), la página de voz y la vista previa, todo disponible desde la barra de
secciones que acompaña a cada proyecto (productor, biblioteca, storyboard, voz y vista previa; en un
video de motion graphics suma "motion"). En un video de motion graphics, esas páginas muestran el
guion, la voz y el video ya generados, y para cambiar algo se lo pedís al productor.
</p>
`;
}

function bodyEn(ctx) {
  return `
<h1>Using the studio</h1>
<p class="lede">
Every video lives in its own project, with its material and its conversation with the producer.
Screenshots show the app with its Spanish interface; the app also has an English mode.
</p>

<h2>Two paths: motion graphics or raw footage</h2>
<p>
When you tap "New video" you choose how to build it. <strong>Motion graphics</strong>: you do not record
anything, you write the script and the studio designs animated scenes with the brand (titles, devices
with their screens, phones, dashboards, photos), adds the voice, picks the music and cuts to the beat.
<strong>Raw footage</strong>: the classic edit of your recordings, with the producer.
</p>
${screenshotFigure(ctx, 'create-mode.png', 'New video: choose between Motion graphics (script and images) and Raw footage (editing recordings)')}

<h2>Motion graphics videos</h2>
<p>
Every motion graphics video has its own <strong>Motion</strong> page. There you fill in the brief: the
brand, the format (horizontal 16:9 or vertical 9:16 for reels), the music (automatic, a brand track or no
music), the goal, the audience and the script. If you add photos, write one line about what each one
shows: the AI does not see them, it chooses by that description.
</p>
${screenshotFigure(ctx, 'motion-brief.png', 'Brief of a motion graphics video: brand, format, music, title, goal, audience and script')}
<p>
"Build storyboard" asks the AI for the scenes (it takes a few minutes); review them before going on,
because changing the script and rebuilding them is cheap. "Make video" synthesizes the voice, prepares
the music and renders, showing progress. The video stays in the project and shows up every time you open
the page. You can also ask the producer for it in the conversation.
</p>
${screenshotFigure(ctx, 'motion-video.png', 'Finished video on the Motion page, with the music credit for the description')}
<h2>Brands: your identity in every video</h2>
<p>
The <strong>Brands</strong> link in the header lists the included brands and yours. "New brand" builds
one from scratch; "Duplicate" starts from an existing one (the included ones are read-only). The editor has
a section per topic — identity, logo, colors, fonts (Google Fonts too, downloaded into the brand), voice,
music, photos and products — and a live preview of the opening and the closing: colors update instantly and
the logo or the fonts recompose the preview. A deleted brand goes to <code>brands/.trash</code>, it is not lost.
</p>
<h2>Adjusting a motion graphics video by chatting</h2>
<p>
On the Motion page, the <strong>"Adjust with the producer"</strong> button opens that video’s chat. Ask for
changes in your own words — "lower the music", "change the title of scene 3", "shorten the closing voice",
"remove the Wi-Fi scene" — and the producer edits those scenes, tells you what changed and remakes the video.
It never rebuilds the storyboard from scratch for an adjustment, so what was already right stays the same.
</p>
${screenshotFigure(ctx, 'motion-adjust-chat.png', 'Producer chat on a motion graphics video, with sample requests to adjust it')}
<p>
Remaking an adjusted video is quick: only the voice of the scenes whose text you changed is recorded again
(lowering the music of a one-minute video takes a minute and a half). Every video has its own music volume;
if it sounds loud, ask the producer to lower it.
</p>
<p>
The brand music is by Kevin MacLeod under a CC BY license: the credit is not drawn over the video, it appears
below the player (and in <code>out/video.credits.txt</code>) so you can paste it into the description of the
post — the license requires it.
</p>

<h2>Uploading material</h2>
<p>
Drag your files (recordings, camera, photos, music, logo) straight onto the conversation area, or use the
"Attach files" button. For each file the producer suggests a role based on what it detects — it has a voice,
it has no audio, it has transparency, it is a photo, its name mentions music — and you confirm or change the
role before it is saved.
</p>
${screenshotFigure(ctx, 'proposal-card.png', 'Card for a freshly uploaded file with the suggested role (B-roll) and the Confirm / Discard buttons')}
<p>
The producer can also look at the photos you uploaded — useful, for example, to build a better Product ad
recipe from your own images.
</p>

<h2>Free material for B-roll</h2>
<p>
If you are short on footage, just ask the producer: something like "find free footage of city bikes" and it
brings you video and photo options from Wikimedia Commons and the NASA library — only with free licenses for
commercial use. Pick the one that works and it is imported like any other file of your material.
</p>
<p>
The credit of every file imported this way (author, source, license) is saved automatically in the project’s
credits file — include it in the video description when you publish it.
</p>

<h2>Recipes (raw footage)</h2>
<p>
They are fine-tuned video templates: tell the producer which one you want (or just describe what you need and
it picks) and it writes the script, the cut and the voice-over following that recipe. Three come built in:
<strong>Tutorial</strong> (screen recording with synchronized narration, captions, soft music and logo),
<strong>Vertical tutorial</strong> (the same recipe in 9:16 for Reels/TikTok/Shorts) and
<strong>Product ad</strong> (a short 9:16 spot built from photos).
</p>

<h2>The Material tab</h2>
<p>
Next to the conversation, the "Material" tab groups everything confirmed by category (A-roll, B-roll,
images, music, logo) with a thumbnail and the duration of each file — to see at a glance what the producer
is working with.
</p>
${screenshotFigure(ctx, 'material-tab.png', 'Material tab of a project, with thumbnails grouped by A-roll, B-roll, images, music and logo')}

<h2>Preview and Deliveries</h2>
<p>
While the producer works, the "Preview" tab shows the latest render as soon as it finishes. When you confirm
it, it also lands in "Deliveries", ready to play or open in Finder — earlier renders stay there too, they do
not overwrite each other.
</p>
${screenshotFigure(ctx, 'workspace-preview.png', 'Conversation with the producer and, on the right, the preview of a finished render')}

<h2>Publishing to YouTube</h2>
<p>
The studio uploads the finished video to your channel without leaving the app. You connect it once, in
<strong>Settings › YouTube</strong>, with your own Google credential: in Google Cloud you create a project,
enable the <strong>YouTube Data API v3</strong> and create an OAuth client of type "Desktop app". You paste the
client ID and secret, tap "Connect with YouTube", allow access in the Google window and come back: the channel
shows up with its name and picture.
</p>
<p>
Then the <strong>"Publish on YouTube"</strong> button (in the preview, in Deliveries or on the Motion page)
opens a dialog: pick the MP4, tap "Propose with the producer" so it writes the title, description (with the
music credit) and tags, and edit them as you like. Choose the visibility (public, unlisted or private) or
schedule a date — a scheduled video is uploaded as private and YouTube publishes it at that time. Before a
public release the studio asks you to confirm which channel it goes to. The upload shows its progress, can be
canceled or retried, and every published video is recorded in the project with its link.
</p>

<h2>Advanced editing</h2>
<p>
For when you want to get your hands dirty: the material library, the storyboard (script and word-by-word
cuts), the voice page and the preview, all available from the section bar that comes with each project
(producer, library, storyboard, voice and preview; a motion graphics video adds "motion"). In a motion
graphics video those pages show the script, the voice and the video already generated, and to change
something you ask the producer.
</p>
`;
}

const PAGES = {
  es: (ctx) => ({
    title: 'Usar el estudio',
    description: 'Cómo armar videos de motion graphics o con tu material, usar recetas, editar a mano y encontrar tus videos terminados en Video Maker.',
    bodyHtml: bodyEs(ctx),
  }),
  en: (ctx) => ({
    title: 'Using the studio',
    description: 'How to build motion graphics videos or videos from your own material, use recipes, edit by hand and find your finished videos in Video Maker.',
    bodyHtml: bodyEn(ctx),
  }),
};

export function renderPage(ctx) {
  return PAGES[ctx.locale](ctx);
}
