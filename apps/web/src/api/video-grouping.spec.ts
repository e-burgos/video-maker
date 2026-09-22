import { describe, expect, it } from 'vitest';

import { archivedVideos, groupVideos, placementFor } from './video-grouping';
import type { ProjectSummary, VideoOrganization } from './render-api-types';

function video(slug: string): ProjectSummary {
  return { slug, layout: { raw: true, catalog: false, timeline: false, edl: false, out: false } };
}

const ORGANIZATION: VideoOrganization = {
  folders: [
    {
      id: 'display-ads',
      name: 'Display Ads',
      categories: [
        { id: 'campanas', name: 'Campañas' },
        { id: 'reportes', name: 'Reportes' },
      ],
    },
    { id: 'tutoriales', name: 'Tutoriales', categories: [] },
  ],
  videos: {
    'editar-campana': { folderId: 'display-ads', categoryId: 'campanas', archived: false },
    'crear-campana': { folderId: 'display-ads', categoryId: 'campanas', archived: false },
    'linea-de-tiempo': { folderId: 'display-ads', categoryId: null, archived: false },
    'optica-siochana': { folderId: null, categoryId: null, archived: true },
  },
};

const VIDEOS = [
  video('editar-campana'),
  video('crear-campana'),
  video('linea-de-tiempo'),
  video('optica-siochana'),
  video('suelto'),
];

describe('placementFor', () => {
  it('reads a video the registry never heard of as unplaced', () => {
    expect(placementFor(ORGANIZATION, 'suelto')).toEqual({
      folderId: null,
      categoryId: null,
      archived: false,
    });
  });
});

describe('groupVideos', () => {
  it('keeps the folders in registry order and puts the unassigned bucket last', () => {
    const groups = groupVideos(VIDEOS, ORGANIZATION);

    expect(groups.map((group) => group.folder?.id ?? 'unassigned')).toEqual([
      'display-ads',
      'tutoriales',
      'unassigned',
    ]);
  });

  it('splits a folder into its uncategorized bucket first and then its categories', () => {
    const [displayAds] = groupVideos(VIDEOS, ORGANIZATION);

    expect(displayAds?.buckets.map((bucket) => bucket.category?.id ?? 'uncategorized')).toEqual([
      'uncategorized',
      'campanas',
      'reportes',
    ]);
    expect(displayAds?.buckets[0]?.videos.map((entry) => entry.slug)).toEqual(['linea-de-tiempo']);
    expect(displayAds?.buckets[1]?.videos.map((entry) => entry.slug)).toEqual([
      'editar-campana',
      'crear-campana',
    ]);
    expect(displayAds?.buckets[2]?.videos).toEqual([]);
  });

  it('counts only the videos of the folder, category by category', () => {
    const [displayAds, tutoriales] = groupVideos(VIDEOS, ORGANIZATION);

    expect(displayAds?.total).toBe(3);
    expect(tutoriales?.total).toBe(0);
  });

  it('never loses a video whose folder disappeared: it lands in the unassigned group', () => {
    const groups = groupVideos([video('huerfano')], {
      folders: [],
      videos: { huerfano: { folderId: null, categoryId: null, archived: false } },
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.folder).toBeNull();
    expect(groups[0]?.buckets[0]?.videos.map((entry) => entry.slug)).toEqual(['huerfano']);
  });

  it('keeps the archived videos out of every group', () => {
    const groups = groupVideos(VIDEOS, ORGANIZATION);
    const listed = groups.flatMap((group) => group.buckets.flatMap((bucket) => bucket.videos));

    expect(listed.map((entry) => entry.slug)).not.toContain('optica-siochana');
  });

  it('hides the unassigned group when every video has a folder', () => {
    const groups = groupVideos([video('editar-campana')], ORGANIZATION);

    expect(groups.map((group) => group.folder?.id ?? 'unassigned')).toEqual([
      'display-ads',
      'tutoriales',
    ]);
  });

  it('still shows the folders when the media root has no videos at all', () => {
    expect(groupVideos([], ORGANIZATION)).toHaveLength(2);
  });
});

describe('archivedVideos', () => {
  it('answers exactly the videos the registry marks as archived', () => {
    expect(archivedVideos(VIDEOS, ORGANIZATION).map((entry) => entry.slug)).toEqual([
      'optica-siochana',
    ]);
  });
});
