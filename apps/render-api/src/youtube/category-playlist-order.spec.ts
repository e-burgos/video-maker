import { describe, expect, it } from 'vitest';

import { orderSlugsByPlaylist, slugsInCategory } from './category-playlist-order';

describe('orderSlugsByPlaylist', () => {
  it('follows the playlist and leaves the videos outside it at the end in their current order', () => {
    const result = orderSlugsByPlaylist({
      slugs: ['stock', 'ventas', 'borrador', 'catalogo'],
      videoIdsBySlug: { stock: ['old-stock', 'new-stock'], ventas: ['v1'], catalogo: ['c1'] },
      playlistVideoIds: ['c1', 'new-stock', 'v1'],
    });
    expect(result).toEqual({ ordered: ['catalogo', 'stock', 'ventas', 'borrador'], notInPlaylist: ['borrador'] });
  });
});

describe('slugsInCategory', () => {
  it('lists a category by position and then by slug', () => {
    const organization = {
      folders: [],
      videos: {
        b: { folderId: 'f', categoryId: 'c', archived: false },
        a: { folderId: 'f', categoryId: 'c', archived: false },
        z: { folderId: 'f', categoryId: 'c', archived: false, position: 0 },
        other: { folderId: 'f', categoryId: 'd', archived: false, position: 0 },
      },
    };
    expect(slugsInCategory(organization, 'c')).toEqual(['z', 'a', 'b']);
  });
});
