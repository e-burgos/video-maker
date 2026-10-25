import { assertLocale } from './routes.mjs';

export const UI_STRINGS = {
  es: {
    'meta.ogLocale': 'es_AR',
    'meta.languageName': 'Español',
    'skip.toContent': 'Saltar al contenido',
    'brand.tagline': 'Estudio de video con IA, local y de código abierto',
    'nav.mainLabel': 'Principal',
    'nav.guideLabel': 'Guía de uso',
    'nav.menu': 'Menú',
    'nav.guide': 'Guía',
    'nav.home': 'Inicio',
    'nav.how-it-works': 'Cómo funciona',
    'nav.technology': 'Tecnología',
    'nav.open-source': 'Código abierto',
    'nav.installation': 'Instalación',
    'nav.first-run': 'Primer arranque',
    'nav.connect-ai': 'Conectar la IA',
    'nav.using-studio': 'Usar el estudio',
    'nav.faq': 'Preguntas frecuentes',
    'nav.licenses': 'Licencias',
    'nav.privacy': 'Privacidad',
    'header.github': 'Código en GitHub',
    'header.download': 'Descargar',
    'header.themeToggle': 'Cambiar entre tema claro y oscuro',
    'lang.switchTo': 'Read in English',
    'lang.switchShort': 'EN',
    'download.cta': 'Descargar para Mac (Apple Silicon)',
    'download.meta': 'macOS 13 Ventura o posterior',
    'footer.product': 'Producto',
    'footer.guide': 'Guía',
    'footer.openSource': 'Código abierto',
    'footer.repo': 'Repositorio en GitHub',
    'footer.issues': 'Reportar un problema',
    'footer.license': 'Licencia MIT',
    'footer.notices': 'Licencias de terceros',
    'footer.download': 'Descargar para Mac',
    'footer.rights': 'Código bajo licencia MIT.',
    'footer.madeIn': 'Hecho en Argentina. Corre entero en tu Mac.',
    'stepper.previous': 'Anterior',
    'stepper.next': 'Siguiente',
    'stepper.status': 'Paso {current} de {total}',
    'stepper.goTo': 'Ir al paso {current}',
    'tabs.label': 'Elegí un camino',
    'guide.onThisSection': 'En esta guía',
  },
  en: {
    'meta.ogLocale': 'en_US',
    'meta.languageName': 'English',
    'skip.toContent': 'Skip to content',
    'brand.tagline': 'Local, open-source AI video studio',
    'nav.mainLabel': 'Main',
    'nav.guideLabel': 'User guide',
    'nav.menu': 'Menu',
    'nav.guide': 'Guide',
    'nav.home': 'Home',
    'nav.how-it-works': 'How it works',
    'nav.technology': 'Technology',
    'nav.open-source': 'Open source',
    'nav.installation': 'Installation',
    'nav.first-run': 'First run',
    'nav.connect-ai': 'Connect the AI',
    'nav.using-studio': 'Using the studio',
    'nav.faq': 'FAQ',
    'nav.licenses': 'Licenses',
    'nav.privacy': 'Privacy',
    'header.github': 'Code on GitHub',
    'header.download': 'Download',
    'header.themeToggle': 'Switch between light and dark theme',
    'lang.switchTo': 'Leer en español',
    'lang.switchShort': 'ES',
    'download.cta': 'Download for Mac (Apple Silicon)',
    'download.meta': 'macOS 13 Ventura or later',
    'footer.product': 'Product',
    'footer.guide': 'Guide',
    'footer.openSource': 'Open source',
    'footer.repo': 'GitHub repository',
    'footer.issues': 'Report an issue',
    'footer.license': 'MIT License',
    'footer.notices': 'Third-party licenses',
    'footer.download': 'Download for Mac',
    'footer.rights': 'Code released under the MIT License.',
    'footer.madeIn': 'Made in Argentina. Runs entirely on your Mac.',
    'stepper.previous': 'Previous',
    'stepper.next': 'Next',
    'stepper.status': 'Step {current} of {total}',
    'stepper.goTo': 'Go to step {current}',
    'tabs.label': 'Pick a path',
    'guide.onThisSection': 'In this guide',
  },
};

export function t(locale, key, variables = {}) {
  const template = UI_STRINGS[assertLocale(locale)][key];
  if (template === undefined) {
    throw new Error(`missing UI string "${key}" for locale "${locale}"`);
  }
  return template.replace(/\{(\w+)\}/g, (placeholder, name) =>
    name in variables ? String(variables[name]) : placeholder,
  );
}

export function pick(locale, localized) {
  const value = localized[assertLocale(locale)];
  if (value === undefined) {
    throw new Error(`missing localized value for locale "${locale}"`);
  }
  return value;
}
