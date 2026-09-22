import type {
  ProjectSummary,
  VideoCategory,
  VideoFolder,
  VideoOrganization,
  VideoPlacement,
} from './render-api-types';

export const UNPLACED: VideoPlacement = { folderId: null, categoryId: null, archived: false };

export type VideoBucket = {
  category: VideoCategory | null;
  videos: ProjectSummary[];
};

export type VideoGroup = {
  folder: VideoFolder | null;
  buckets: VideoBucket[];
  total: number;
};

export function placementFor(organization: VideoOrganization, slug: string): VideoPlacement {
  return organization.videos[slug] ?? UNPLACED;
}

function isLive(organization: VideoOrganization, video: ProjectSummary): boolean {
  return !placementFor(organization, video.slug).archived;
}

export function archivedVideos(
  videos: readonly ProjectSummary[],
  organization: VideoOrganization,
): ProjectSummary[] {
  return videos.filter((video) => placementFor(organization, video.slug).archived);
}

function bucketsFor(
  folder: VideoFolder | null,
  videos: readonly ProjectSummary[],
  organization: VideoOrganization,
): VideoBucket[] {
  const folderId = folder?.id ?? null;
  const inFolder = videos.filter((video) => placementFor(organization, video.slug).folderId === folderId);

  const uncategorized = inFolder.filter(
    (video) => placementFor(organization, video.slug).categoryId === null,
  );

  const categorized = (folder?.categories ?? []).map((category) => ({
    category,
    videos: inFolder.filter((video) => placementFor(organization, video.slug).categoryId === category.id),
  }));

  return [{ category: null, videos: uncategorized }, ...categorized];
}

function toGroup(
  folder: VideoFolder | null,
  videos: readonly ProjectSummary[],
  organization: VideoOrganization,
): VideoGroup {
  const buckets = bucketsFor(folder, videos, organization);
  return {
    folder,
    buckets,
    total: buckets.reduce((count, bucket) => count + bucket.videos.length, 0),
  };
}

export function groupVideos(
  videos: readonly ProjectSummary[],
  organization: VideoOrganization,
): VideoGroup[] {
  const live = videos.filter((video) => isLive(organization, video));
  const folderGroups = organization.folders.map((folder) => toGroup(folder, live, organization));
  const unassigned = toGroup(null, live, organization);

  return unassigned.total === 0 ? folderGroups : [...folderGroups, unassigned];
}
