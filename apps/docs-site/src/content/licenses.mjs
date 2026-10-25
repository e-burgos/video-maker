import { REPO_LICENSE_URL } from '../site-config.mjs';
import { renderMarkdownLite } from '../markdown-lite.mjs';
import { pageHref } from '../routes.mjs';

const PAGES = {
  es: (ctx) => ({
    title: 'Licencias',
    description: 'Licencias de todo el software, los modelos y las voces de terceros que empaqueta Video Maker.',
    intro: `<h1>Licencias</h1>
<p class="lede">
El código de Video Maker tiene <a href="${REPO_LICENSE_URL}">licencia MIT</a>. La app empaqueta además binarios,
modelos y voces de terceros con sus propias licencias: esta lista se genera a partir del mismo
<code>THIRD_PARTY_NOTICES.md</code> que la app muestra desde su menú ("Acerca de / Licencias"). Qué hace cada
componente se explica en <a href="${pageHref(ctx, 'technology')}">Tecnología</a>.
</p>`,
  }),
  en: (ctx) => ({
    title: 'Licenses',
    description: 'Licenses of all the third-party software, models and voices bundled with Video Maker.',
    intro: `<h1>Licenses</h1>
<p class="lede">
The Video Maker code is under the <a href="${REPO_LICENSE_URL}">MIT license</a>. The app also bundles third-party
binaries, models and voices under their own licenses: this list is generated from the same
<code>THIRD_PARTY_NOTICES.md</code> the app shows from its menu ("Acerca de / Licencias"). What each component does is
explained on <a href="${pageHref(ctx, 'technology')}">Technology</a>.
</p>`,
  }),
};

export function renderPage(ctx, noticesMarkdown) {
  const { title, description, intro } = PAGES[ctx.locale](ctx);
  return { title, description, bodyHtml: `\n${intro}\n<div class="notices">${renderMarkdownLite(noticesMarkdown)}</div>\n` };
}
