import type { Organization } from '../store/organization';

export interface CategoryOrderInput {
  readonly slugs: readonly string[];
  readonly videoIdsBySlug: Readonly<Record<string, readonly string[]>>;
  readonly playlistVideoIds: readonly string[];
}

export interface CategoryOrderResult {
  readonly categoryId: string;
  readonly playlistId: string;
  readonly ordered: number;
  readonly notInPlaylist: readonly string[];
}

export function slugsInCategory(organization: Organization, categoryId: string): readonly string[] {
  return Object.entries(organization.videos)
    .filter(([, placement]) => placement.categoryId === categoryId)
    .sort(([leftSlug, left], [rightSlug, right]) => compareByPosition(left.position, right.position) || leftSlug.localeCompare(rightSlug))
    .map(([slug]) => slug);
}

function compareByPosition(left: number | undefined, right: number | undefined): number {
  return (left ?? Number.POSITIVE_INFINITY) - (right ?? Number.POSITIVE_INFINITY) || 0;
}

function playlistIndexOf(videoIds: readonly string[], playlistVideoIds: readonly string[]): number {
  const indexes = videoIds.map((videoId) => playlistVideoIds.indexOf(videoId)).filter((index) => index >= 0);
  return indexes.length === 0 ? -1 : Math.min(...indexes);
}

export function orderSlugsByPlaylist(input: CategoryOrderInput): { readonly ordered: readonly string[]; readonly notInPlaylist: readonly string[] } {
  const ranked = input.slugs.map((slug) => ({ slug, index: playlistIndexOf(input.videoIdsBySlug[slug] ?? [], input.playlistVideoIds) }));
  const inPlaylist = ranked.filter((entry) => entry.index >= 0).sort((left, right) => left.index - right.index);
  const notInPlaylist = ranked.filter((entry) => entry.index < 0).map((entry) => entry.slug);
  return { ordered: [...inPlaylist.map((entry) => entry.slug), ...notInPlaylist], notInPlaylist };
}
