export const RENDER_API_BASE_PATH = '/api';

function encodeArtifactPath(path: string): string {
  return path
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function artifactUrl(slug: string, path: string): string {
  return `${RENDER_API_BASE_PATH}/projects/${encodeURIComponent(slug)}/files/${encodeArtifactPath(path)}`;
}

export function servicePathUrl(path: string): string {
  return `${RENDER_API_BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}
