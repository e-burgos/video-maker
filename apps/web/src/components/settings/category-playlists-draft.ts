import type { CategoryPlaylists } from '../../api/publish-queue-types';

export function sameCategoryPlaylists(left: CategoryPlaylists, right: CategoryPlaylists): boolean {
  if (left.generalPlaylistId !== right.generalPlaylistId) {
    return false;
  }
  const categoryIds = new Set([...Object.keys(left.categoryPlaylists), ...Object.keys(right.categoryPlaylists)]);
  return [...categoryIds].every((id) => (left.categoryPlaylists[id] ?? null) === (right.categoryPlaylists[id] ?? null));
}
