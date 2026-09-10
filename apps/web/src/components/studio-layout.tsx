import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { ServiceHealthBadge } from './service-health-badge';

const PROJECT_SECTIONS = [
  { path: '/producer', label: 'producer' },
  { path: '', label: 'library' },
  { path: '/storyboard', label: 'storyboard' },
  { path: '/voice', label: 'voice' },
  { path: '/preview', label: 'preview' },
] as const;

export function projectSlugFromPathname(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)(?:\/|$)/.exec(pathname);
  return match === null ? null : decodeURIComponent(match[1] as string);
}

export function StudioLayout() {
  const slug = projectSlugFromPathname(useLocation().pathname);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-baseline gap-3">
            <NavLink to="/" className="text-lg font-semibold tracking-tight">
              Video Maker Studio
            </NavLink>
            <span className="text-xs text-slate-500">local render service</span>
          </div>
          <ServiceHealthBadge />
        </div>

        {slug !== null && (
          <nav
            data-testid="project-nav"
            className="mx-auto flex max-w-6xl items-center gap-3 px-6 pb-3 font-mono text-xs"
          >
            {PROJECT_SECTIONS.map((section) => (
              <NavLink
                key={section.label}
                end={section.path === ''}
                to={`/projects/${slug}${section.path}`}
                className={({ isActive }) =>
                  `rounded-md border px-2 py-1 ${
                    isActive
                      ? 'border-sky-500/60 bg-sky-500/10 text-sky-100'
                      : 'border-slate-800 text-slate-400 hover:border-slate-600'
                  }`
                }
              >
                {section.label}
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
