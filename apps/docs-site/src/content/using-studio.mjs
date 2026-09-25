import { screenshotFigure } from '../render.mjs';

export function renderPage(depth) {
  const bodyHtml = `
<h1>Usar el estudio</h1>
<p class="lede">
Cada video vive en su propio proyecto, con su material y su conversación con el productor.
</p>

<h2>Subir material</h2>
<p>
Arrastrá tus archivos (grabaciones, cámara, fotos, música, logo) directo sobre la zona de
conversación, o usá el botón "Adjuntar archivos". Por cada archivo, el productor propone un rol
según lo que detecta — tiene voz, no tiene audio, tiene transparencia, es una foto, su nombre
menciona música — y vos confirmás o cambiás el rol antes de que se guarde.
</p>
${screenshotFigure(depth, 'proposal-card.png', 'Tarjeta de material recién subido con el rol propuesto (B-roll) y los botones Confirmar / Descartar')}

<h2>Recetas</h2>
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

<h2>Edición avanzada</h2>
<p>
Para cuando querés meter mano vos mismo: la biblioteca de material, el storyboard (guion y cortes
palabra por palabra) y la página de voz, todo disponible desde "Edición avanzada" arriba de cada
proyecto.
</p>
`;

  return {
    title: 'Usar el estudio',
    description: 'Cómo subir material, usar recetas, editar a mano y encontrar tus videos terminados en Video Maker.',
    bodyHtml,
  };
}
