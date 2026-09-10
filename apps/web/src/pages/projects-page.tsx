import { useCallback } from 'react';
import { Link } from 'react-router-dom';

import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { CreateProjectForm } from '../components/create-project-form';
import { ErrorNotice } from '../components/error-notice';
import type { ProjectLayout, ProjectSummary } from '../api/render-api-types';

const LAYOUT_FLAGS: ReadonlyArray<keyof ProjectLayout> = ['raw', 'catalog', 'timeline', 'edl', 'out'];

function LayoutFlags({ layout }: { layout: ProjectLayout }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {LAYOUT_FLAGS.map((flag) => (
        <li
          key={flag}
          data-present={layout[flag]}
          className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 data-[present=true]:border-emerald-500/50 data-[present=true]:text-emerald-300"
        >
          {flag}
        </li>
      ))}
    </ul>
  );
}

export function ProjectsPage() {
  const client = useRenderApi();
  const load = useCallback(() => client.listProjects(), [client]);
  const projects = useAsyncResource<ProjectSummary[]>(load, 'projects');

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every media project under the service media root.
          </p>
        </div>
        <CreateProjectForm onCreated={projects.reload} />
      </div>

      {projects.status === 'loading' && <p className="text-sm text-slate-500">Loading projects…</p>}
      {projects.status === 'error' && projects.error !== null && (
        <ErrorNotice error={projects.error} onRetry={projects.reload} />
      )}
      {projects.status === 'ready' && projects.data !== null && projects.data.length === 0 && (
        <p className="text-sm text-slate-500">
          No projects yet. Create one above, then upload its raw assets.
        </p>
      )}
      {projects.status === 'ready' && projects.data !== null && projects.data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.data.map((project) => (
            <li key={project.slug}>
              <Link
                to={`/projects/${encodeURIComponent(project.slug)}/producer`}
                className="block rounded-lg border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-600"
              >
                <p className="font-mono text-sm font-medium text-slate-100">{project.slug}</p>
                <div className="mt-3">
                  <LayoutFlags layout={project.layout} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
