import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { orderSlugsByPlaylist, slugsInCategory } from '../../youtube/category-playlist-order';
import type { CategoryOrderResult } from '../../youtube/category-playlist-order';
import { readCategoryPlaylistSettings } from '../../youtube/publish-queue-settings';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpResponse } from '../http-message';
import type { RenderApiRuntime } from '../render-api-runtime';

function publishedVideoIds(deps: RenderApiDependencies, slug: string): readonly string[] {
  return deps.localStore.publications
    .listByProject(slug)
    .flatMap((publication) => (publication.platform === 'youtube' && publication.videoId !== null ? [publication.videoId] : []));
}

export async function handleOrderCategoriesByPlaylists(
  deps: RenderApiDependencies,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const { categoryPlaylists } = readCategoryPlaylistSettings(deps.localStore.settings);
  const organization = deps.localStore.organization.getOrganization();
  const categories: CategoryOrderResult[] = [];

  for (const [categoryId, playlistId] of Object.entries(categoryPlaylists)) {
    const slugs = slugsInCategory(organization, categoryId);
    if (slugs.length === 0) {
      continue;
    }
    const playlistVideoIds = await runtime.youtube.client.listPlaylistVideoIds(playlistId);
    const videoIdsBySlug = Object.fromEntries(slugs.map((slug) => [slug, publishedVideoIds(deps, slug)]));
    const { ordered, notInPlaylist } = orderSlugsByPlaylist({ slugs, videoIdsBySlug, playlistVideoIds });
    deps.localStore.organization.setCategoryOrder(categoryId, ordered);
    categories.push({ categoryId, playlistId, ordered: ordered.length - notInPlaylist.length, notInPlaylist });
  }

  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body: { categories } };
}
