export const ROUTES = [
  { id: 'health', method: 'GET', pattern: '/health' },
  { id: 'projects.list', method: 'GET', pattern: '/projects' },
  { id: 'projects.create', method: 'POST', pattern: '/projects' },
  { id: 'projects.detail', method: 'GET', pattern: '/projects/:slug' },
  { id: 'projects.assets.list', method: 'GET', pattern: '/projects/:slug/assets' },
  { id: 'projects.assets.upload', method: 'PUT', pattern: '/projects/:slug/assets/:role/:filename' },
  { id: 'projects.timeline.get', method: 'GET', pattern: '/projects/:slug/timeline' },
  { id: 'projects.timeline.put', method: 'PUT', pattern: '/projects/:slug/timeline' },
  { id: 'projects.edl.get', method: 'GET', pattern: '/projects/:slug/edl' },
  { id: 'projects.edl.put', method: 'PUT', pattern: '/projects/:slug/edl' },
  { id: 'projects.files.get', method: 'GET', pattern: '/projects/:slug/files/*path' },
  { id: 'projects.storyboard.get', method: 'GET', pattern: '/projects/:slug/storyboard' },
  { id: 'projects.storyboard.put', method: 'PUT', pattern: '/projects/:slug/storyboard' },
  { id: 'projects.storyboard.prompts', method: 'GET', pattern: '/projects/:slug/storyboard/prompts' },
  { id: 'projects.jobs.create', method: 'POST', pattern: '/projects/:slug/jobs' },
  { id: 'projects.jobs.list', method: 'GET', pattern: '/projects/:slug/jobs' },
  { id: 'jobs.detail', method: 'GET', pattern: '/jobs/:jobId' },
  { id: 'jobs.cancel', method: 'DELETE', pattern: '/jobs/:jobId' },
] as const;

export type RouteId = (typeof ROUTES)[number]['id'];
