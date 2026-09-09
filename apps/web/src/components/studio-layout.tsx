import { NavLink, Outlet } from 'react-router-dom';

import { ServiceHealthBadge } from './service-health-badge';

export function StudioLayout() {
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
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
