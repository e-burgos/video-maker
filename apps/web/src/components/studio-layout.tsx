import { useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { projectModeOf } from '../api/project-mode';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { LanguageSwitch } from './language-switch';
import { ServiceHealthBadge } from './service-health-badge';

type ProjectSection = {
  path: string;
  labelKey: TranslationKey;
  end?: boolean;
  motionOnly?: boolean;
};

const PROJECT_SECTIONS: readonly ProjectSection[] = [
  { path: '', labelKey: 'nav.productor', end: true },
  { path: '/motion', labelKey: 'nav.motion', motionOnly: true },
  { path: '/library', labelKey: 'nav.library' },
  { path: '/storyboard', labelKey: 'nav.storyboard' },
  { path: '/voice', labelKey: 'nav.voice' },
  { path: '/preview', labelKey: 'nav.preview' },
];

const HEADER_LINKS = [
  { to: '/brands', testId: 'brands-nav', labelKey: 'nav.brands' },
  { to: '/settings', testId: 'settings-nav', labelKey: 'nav.settings' },
  { to: '/guide', testId: 'guide-nav', labelKey: 'nav.guide' },
] as const satisfies readonly { to: string; testId: string; labelKey: TranslationKey }[];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `rounded-md border px-3 py-1.5 text-sm font-medium capitalize ${
    isActive
      ? 'border-sky-500/60 bg-sky-500/10 text-sky-100'
      : 'border-slate-800 text-slate-400 hover:border-slate-600'
  }`;
}

export function projectSlugFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)(?:\/|$)/.exec(pathname);
  return match === null ? null : decodeURIComponent(match[1] as string);
}

export function StudioLayout() {
  const { pathname } = useLocation();
  const slug = projectSlugFromPathname(pathname);
  const t = useT();
  const client = useRenderApi();
  const project = useAsyncResource(
    useCallback(async () => (slug === null ? null : client.getProject(slug)), [client, slug]),
    `layout-project:${slug ?? ''}`,
  );
  const isMotion = project.data !== null && projectModeOf(project.data) === 'motion';
  const sections = PROJECT_SECTIONS.filter((section) => isMotion || section.motionOnly !== true);

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="shrink-0 border-b border-slate-800 bg-slate-900/60">
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

        {slug !== null && (
          <nav
            data-testid="project-nav"
            className="mx-auto flex max-w-6xl items-center gap-3 px-6 pb-3 font-mono text-xs"
          >
            {sections.map((section) => (
              <NavLink
                key={section.labelKey}
                to={`/projects/${encodeURIComponent(slug)}${section.path}`}
                end={section.end}
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
      <main className="mx-auto min-h-0 w-full max-w-6xl flex-1 overflow-y-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
