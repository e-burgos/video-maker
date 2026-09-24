import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { LanguageSwitch } from './language-switch';
import { ServiceHealthBadge } from './service-health-badge';

const PROJECT_SECTIONS = [
  { path: '/library', labelKey: 'nav.library' },
  { path: '/storyboard', labelKey: 'nav.storyboard' },
  { path: '/voice', labelKey: 'nav.voice' },
  { path: '/preview', labelKey: 'nav.preview' },
] as const satisfies readonly { path: string; labelKey: TranslationKey }[];

const HEADER_LINKS = [
  { to: '/settings', testId: 'settings-nav', labelKey: 'nav.settings' },
  { to: '/guide', testId: 'guide-nav', labelKey: 'nav.guide' },
] as const satisfies readonly { to: string; testId: string; labelKey: TranslationKey }[];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `rounded-md border px-2 py-1 font-mono text-xs ${
    isActive
      ? 'border-sky-500/60 bg-sky-500/10 text-sky-100'
      : 'border-slate-800 text-slate-400 hover:border-slate-600'
  }`;
}

export function projectSlugFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)(?:\/|$)/.exec(pathname);
  return match === null ? null : decodeURIComponent(match[1] as string);
}

export function isProjectWorkspaceRoot(pathname: string, slug: string): boolean {
  const rest = pathname.slice(`/projects/${encodeURIComponent(slug)}`.length);
  return rest === '' || rest === '/';
}

export function StudioLayout() {
  const { pathname } = useLocation();
  const slug = projectSlugFromPathname(pathname);
  const showProjectNav = slug !== null && !isProjectWorkspaceRoot(pathname, slug);
  const t = useT();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-baseline gap-3">
            <NavLink to="/" className="text-lg font-semibold tracking-tight">
              {t('layout.title')}
            </NavLink>
            <span className="text-xs text-slate-500">{t('layout.subtitle')}</span>
          </div>
          <div className="flex items-center gap-3">
            {HEADER_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} data-testid={link.testId} className={navLinkClass}>
                {t(link.labelKey)}
              </NavLink>
            ))}
            <ServiceHealthBadge />
            <LanguageSwitch />
          </div>
        </div>

        {showProjectNav && (
          <nav
            data-testid="project-nav"
            className="mx-auto flex max-w-6xl items-center gap-3 px-6 pb-3 font-mono text-xs"
          >
            {PROJECT_SECTIONS.map((section) => (
              <NavLink
                key={section.labelKey}
                to={`/projects/${slug}${section.path}`}
                className={({ isActive }) =>
                  `rounded-md border px-2 py-1 ${
                    isActive
                      ? 'border-sky-500/60 bg-sky-500/10 text-sky-100'
                      : 'border-slate-800 text-slate-400 hover:border-slate-600'
                  }`
                }
              >
                {t(section.labelKey)}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
