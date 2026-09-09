import { ROUTES } from './routes';
import type { RouteId } from './routes';

export type RouteParams = Readonly<Record<string, string>>;

export type RouteMatch =
  | { readonly kind: 'matched'; readonly id: RouteId; readonly params?: RouteParams }
  | { readonly kind: 'method-not-allowed'; readonly allow: readonly string[] }
  | { readonly kind: 'not-found' };

type PatternSegment =
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'param'; readonly name: string }
  | { readonly kind: 'wildcard'; readonly name: string };

function parsePattern(pattern: string): readonly PatternSegment[] {
  return pattern
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      if (segment.startsWith('*')) {
        return { kind: 'wildcard' as const, name: segment.slice(1) };
      }
      if (segment.startsWith(':')) {
        return { kind: 'param' as const, name: segment.slice(1) };
      }
      return { kind: 'literal' as const, value: segment };
    });
}

function toPathSegments(path: string): readonly string[] {
  const withoutLeadingSlash = path.startsWith('/') ? path.slice(1) : path;
  return withoutLeadingSlash.length === 0 ? [] : withoutLeadingSlash.split('/');
}

function decodeSegment(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function matchSegments(
  patternSegments: readonly PatternSegment[],
  pathSegments: readonly string[],
): RouteParams | null {
  const lastPatternSegment = patternSegments[patternSegments.length - 1];
  const hasWildcard = lastPatternSegment !== undefined && lastPatternSegment.kind === 'wildcard';

  const lengthMismatch = hasWildcard
    ? pathSegments.length < patternSegments.length
    : pathSegments.length !== patternSegments.length;
  if (lengthMismatch) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    if (patternSegment === undefined) {
      return null;
    }

    if (patternSegment.kind === 'wildcard') {
      const decodedTail: string[] = [];
      for (const raw of pathSegments.slice(index)) {
        const decoded = decodeSegment(raw);
        if (decoded === null) {
          return null;
        }
        decodedTail.push(decoded);
      }
      params[patternSegment.name] = decodedTail.join('/');
      return params;
    }

    const rawSegment = pathSegments[index];
    if (rawSegment === undefined || rawSegment === '') {
      return null;
    }

    if (patternSegment.kind === 'literal') {
      if (rawSegment !== patternSegment.value) {
        return null;
      }
      continue;
    }

    const decoded = decodeSegment(rawSegment);
    if (decoded === null) {
      return null;
    }
    params[patternSegment.name] = decoded;
  }

  return params;
}

export function normalizePath(path: string): string {
  const queryIndex = path.indexOf('?');
  const withoutQuery = queryIndex === -1 ? path : path.slice(0, queryIndex);

  if (withoutQuery === '/') {
    return withoutQuery;
  }
  return withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery;
}

export function routeRequest(method: string, path: string): RouteMatch {
  const pathSegments = toPathSegments(path);

  const matches: { readonly id: RouteId; readonly method: string; readonly params: RouteParams }[] = [];
  for (const route of ROUTES) {
    const params = matchSegments(parsePattern(route.pattern), pathSegments);
    if (params !== null) {
      matches.push({ id: route.id, method: route.method, params });
    }
  }

  if (matches.length === 0) {
    return { kind: 'not-found' };
  }

  const matchForMethod = matches.find((candidate) => candidate.method === method);
  if (matchForMethod === undefined) {
    return { kind: 'method-not-allowed', allow: matches.map((candidate) => candidate.method) };
  }

  return Object.keys(matchForMethod.params).length > 0
    ? { kind: 'matched', id: matchForMethod.id, params: matchForMethod.params }
    : { kind: 'matched', id: matchForMethod.id };
}
