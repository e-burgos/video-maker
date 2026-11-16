import { describe, expect, it } from 'vitest';

import {
  ALL_FOLDERS,
  effectiveFolderSelection,
  filterVideosByQuery,
  folderIdOf,
  matchesVideoQuery,
  visibleGroups,
} from './video-filter';
import type { ProjectSummary } from './render-api-types';
import type { VideoGroup } from './video-grouping';

const LAYOUT = { raw: false, catalog: false, timeline: false, edl: false, out: false };

function video(slug: string, title?: string): ProjectSummary {
  return { slug, layout: LAYOUT, ...(title === undefined ? {} : { title }) };
}

function group(id: string | null, total: number): VideoGroup {
  return { folder: id === null ? null : { id, name: id, categories: [] }, buckets: [], total };
}

describe('matchesVideoQuery', () => {
  it('matches every video on a blank query', () => {
    expect(matchesVideoQuery(video('a'), '   ')).toBe(true);
  });

  it('matches the slug or the title, ignoring case and accents', () => {
    expect(matchesVideoQuery(video('crear-campana-ads'), 'CAMPAÑA'.replace('Ñ', 'N'))).toBe(true);
    expect(matchesVideoQuery(video('x', 'Campaña de verano'), 'campana')).toBe(true);
    expect(matchesVideoQuery(video('x', 'Campaña de verano'), 'ads')).toBe(false);
  });
});

describe('filterVideosByQuery', () => {
  it('keeps only the matching videos', () => {
    expect(filterVideosByQuery([video('uno'), video('dos')], 'do').map((entry) => entry.slug)).toEqual(['dos']);
  });
});

describe('visibleGroups', () => {
  const groups = [group('a', 2), group('b', 0), group(null, 1)];

  it('shows every group, empty ones included, when nobody is searching', () => {
    expect(visibleGroups(groups, ALL_FOLDERS, false)).toHaveLength(3);
  });

  it('hides the groups without matches while searching', () => {
    expect(visibleGroups(groups, ALL_FOLDERS, true).map(folderIdOf)).toEqual(['a', 'unassigned']);
  });

  it('narrows to the selected folder', () => {
    expect(visibleGroups(groups, 'b', false).map(folderIdOf)).toEqual(['b']);
  });
});

describe('effectiveFolderSelection', () => {
  it('falls back to all when the selected folder no longer exists', () => {
    expect(effectiveFolderSelection([group('a', 1)], 'gone')).toBe(ALL_FOLDERS);
    expect(effectiveFolderSelection([group('a', 1)], 'a')).toBe('a');
  });
});
