import { renderMarkdownLite } from '../markdown-lite.mjs';

export function renderPage(depth, noticesMarkdown) {
  const bodyHtml = `
<h1>Licencias</h1>
<p class="lede">
Video Maker empaqueta varios binarios, modelos y voces de terceros. Esta lista se genera a partir
del mismo <code>THIRD_PARTY_NOTICES.md</code> que la app muestra desde su menú
("Acerca de / Licencias").
</p>
${renderMarkdownLite(noticesMarkdown)}
`;

  return {
    title: 'Licencias',
    description: 'Licencias de todo el software, los modelos y las voces de terceros que empaqueta Video Maker.',
    bodyHtml,
  };
}
