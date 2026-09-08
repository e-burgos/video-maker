export const ROUTES = [{ id: 'health', method: 'GET', path: '/health' }] as const;

export type RouteId = (typeof ROUTES)[number]['id'];
