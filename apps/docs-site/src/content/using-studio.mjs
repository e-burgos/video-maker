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
${screenshotFigure(depth, 'role-proposal.png', 'Tarjeta de material recién subido con el rol propuesto (B-roll) y los botones Confirmar / Descartar')}

<h2>Recetas</h2>
<p>
Son plantillas de video ya afinadas: le contás al productor cuál querés usar (o simplemente
describís qué necesitás y él elige) y arma el guion, el corte y la locución siguiendo esa receta.
Vienen tres de fábrica: <strong>Tutorial</strong> (pantalla grabada con narración sincronizada,
subtítulos, música suave y logo), <strong>Tutorial vertical</strong> (la misma receta en 9:16 para
Reels/TikTok/Shorts) y <strong>Publicidad</strong> (spot corto en 9:16 armado a partir de fotos).
</p>

<h2>Edición avanzada</h2>
<p>
Para cuando querés meter mano vos mismo: la biblioteca de material, el storyboard (guion y cortes
palabra por palabra), la página de voz y la vista previa del render, todo disponible desde
"Edición avanzada" arriba de cada proyecto.
</p>
${screenshotFigure(depth, 'library-advanced.png', 'Biblioteca de material de un proyecto con las categorías A-roll, B-roll, imágenes, música y logo, y dónde subir a cada una')}

<h2>Entregas</h2>
<p>
Cuando el productor termina un render, aparece en la pestaña "Entregas" del proyecto, listo para
reproducir o abrir en Finder. Los renders anteriores quedan ahí también, no se pisan entre sí.
</p>
`;

  return {
    title: 'Usar el estudio',
    description: 'Cómo subir material, usar recetas, editar a mano y encontrar tus videos terminados en Video Maker.',
    bodyHtml,
  };
}
