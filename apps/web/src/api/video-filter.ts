import { projectDisplayName } from './humanize-slug';
import type { ProjectSummary } from './render-api-types';
import type { VideoGroup } from './video-grouping';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .trim();
}

export function matchesVideoQuery(video: ProjectSummary, query: string): boolean {
  const needle = normalize(query);
  if (needle === '') {
    return true;
  }
  return normalize(projectDisplayName(video)).includes(needle) || normalize(video.slug).includes(needle);
}

export function filterVideosByQuery(videos: readonly ProjectSummary[], query: string): ProjectSummary[] {
  return videos.filter((video) => matchesVideoQuery(video, query));
}

export const ALL_FOLDERS = 'all';
export const UNASSIGNED_FOLDER = 'unassigned';

export function folderIdOf(group: VideoGroup): string {
  return group.folder?.id ?? UNASSIGNED_FOLDER;
}

export function visibleGroups(
  groups: readonly VideoGroup[],
  selectedFolder: string,
  searching: boolean,
): VideoGroup[] {
  const inSelection = selectedFolder === ALL_FOLDERS ? groups : groups.filter((group) => folderIdOf(group) === selectedFolder);
  return searching ? inSelection.filter((group) => group.total > 0) : [...inSelection];
}

export function effectiveFolderSelection(groups: readonly VideoGroup[], selectedFolder: string): string {
  return selectedFolder === ALL_FOLDERS || groups.some((group) => folderIdOf(group) === selectedFolder)
    ? selectedFolder
    : ALL_FOLDERS;
}
