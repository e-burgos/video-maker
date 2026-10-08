import { screenshotFigure } from '../render.mjs';

export function renderPage(depth) {
  const bodyHtml = `
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
${screenshotFigure(depth, 'create-mode.png', 'Nuevo video: elegir entre Motion graphics (guion e imágenes) y Material crudo (montaje de grabaciones)')}

<h2>Videos de motion graphics</h2>
<p>
Cada video de motion graphics tiene su página <strong>Motion</strong>. Ahí completás el brief: la
marca, el formato (horizontal 16:9 o vertical 9:16 para reels), la música (automática, un tema de
la marca o sin música), el objetivo, el público y el guion. Si sumás fotos, escribí en una línea qué
muestra cada una: la IA no las ve, elige por esa descripción.
</p>
${screenshotFigure(depth, 'motion-brief.png', 'Brief de un video de motion graphics: marca, formato, música, título, objetivo, público y guion')}
<p>
"Armar storyboard" le pide a la IA las escenas (tarda unos minutos); revisalas antes de seguir,
porque cambiar el guion y volver a armarlas es barato. "Hacer video" sintetiza la voz, prepara la
música y renderiza, mostrando el avance. El video queda en el proyecto y se ve cada vez que abrís la
página. También se lo podés pedir al productor en la conversación.
</p>
${screenshotFigure(depth, 'motion-video.png', 'Video terminado en la página Motion, con el crédito de la música para la descripción')}
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
${screenshotFigure(depth, 'motion-adjust-chat.png', 'Chat del productor en un video de motion graphics, con ejemplos de pedidos para ajustarlo')}
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
${screenshotFigure(depth, 'proposal-card.png', 'Tarjeta de material recién subido con el rol propuesto (B-roll) y los botones Confirmar / Descartar')}
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
${screenshotFigure(depth, 'material-tab.png', 'Pestaña Material de un proyecto, con miniaturas agrupadas por A-roll, B-roll, imágenes, música y logo')}

<h2>Vista previa y Entregas</h2>
<p>
Mientras el productor trabaja, la pestaña "Vista previa" muestra el render más reciente apenas
termina. Cuando lo confirmás, queda también en "Entregas", listo para reproducir o abrir en
Finder — los renders anteriores quedan ahí también, no se pisan entre sí.
</p>
${screenshotFigure(depth, 'workspace-preview.png', 'Conversación con el productor y, a la derecha, la vista previa de un render ya terminado')}

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

  return {
    title: 'Usar el estudio',
    description: 'Cómo armar videos de motion graphics o con tu material, usar recetas, editar a mano y encontrar tus videos terminados en Video Maker.',
    bodyHtml,
  };
}
