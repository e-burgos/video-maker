import { ROUTES } from './routes';
import type { RouteId } from './routes';

export type RouteMatch =
  | { readonly kind: 'matched'; readonly id: RouteId }
  | { readonly kind: 'method-not-allowed'; readonly allow: readonly string[] }
  | { readonly kind: 'not-found' };

export function normalizePath(path: string): string {
  const queryIndex = path.indexOf('?');
  const withoutQuery = queryIndex === -1 ? path : path.slice(0, queryIndex);

  if (withoutQuery === '/') {
    return withoutQuery;
  }
  return withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery;
}

export function routeRequest(method: string, path: string): RouteMatch {
  const matchingPath = ROUTES.filter((route) => route.path === path);

  if (matchingPath.length === 0) {
    return { kind: 'not-found' };
  }

  const matchingMethod = matchingPath.find((route) => route.method === method);
  if (matchingMethod === undefined) {
    return { kind: 'method-not-allowed', allow: matchingPath.map((route) => route.method) };
  }

  return { kind: 'matched', id: matchingMethod.id };
}
