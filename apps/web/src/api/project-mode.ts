import type { ProjectMode, ProjectSummary } from './render-api-types';

export function projectModeOf(project: Pick<ProjectSummary, 'mode'>): ProjectMode {
  return project.mode ?? 'footage';
}

export function projectHref(project: Pick<ProjectSummary, 'slug' | 'mode'>): string {
  const base = `/projects/${encodeURIComponent(project.slug)}`;
  return projectModeOf(project) === 'motion' ? `${base}/motion` : base;
}
