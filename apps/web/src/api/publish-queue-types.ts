import type { RenderApiErrorPayload } from './render-api-types';
import type { YouTubePrivacy } from './youtube-types';

export const PUBLISH_QUEUE_STATUSES = ['queued', 'publishing', 'published', 'already-published', 'failed'] as const;

export type PublishQueueStatus = (typeof PUBLISH_QUEUE_STATUSES)[number];

export type PublishQueueMetadata = {
  title: string;
  description: string;
  tags: string[];
  privacy: YouTubePrivacy;
  publishAt?: string;
  playlistIds?: string[];
  thumbnail?: string;
  categoryId?: string;
  madeForKids?: boolean;
  defaultLanguage?: string;
  ignoreReview?: boolean;
};

export type PublishQueueItem = {
  id: string;
  slug: string;
  file: string;
  metadata: PublishQueueMetadata;
  position: number;
  status: PublishQueueStatus;
  attempts: number;
  lastError: RenderApiErrorPayload | null;
  nextAttemptAt: string | null;
  jobId: string | null;
  url: string | null;
};

export type PublishQueueSettings = {
  paused: boolean;
  dailyLimit: number;
};

export type PublishQueue = {
  settings: PublishQueueSettings;
  publishedLast24h: number;
  nextAttemptAt: string | null;
  items: PublishQueueItem[];
};

export type PublishQueueAddInput = {
  slug: string;
  file?: string;
  title: string;
  description?: string;
  tags?: string[];
  privacy: YouTubePrivacy;
  publishAt?: string;
  playlistIds?: string[];
  thumbnail?: string;
  ignoreReview?: boolean;
};

export type PublishQueueAddResult = {
  item: PublishQueueItem;
  alreadyPublished: { url: string | null } | null;
};

export type PublishQueueItemPatch = {
  position?: number;
  metadata?: Partial<PublishQueueMetadata>;
  status?: 'queued';
};

export type PublishQueueSettingsPatch = {
  paused?: boolean;
  dailyLimit?: number;
};

export type CategoryPlaylists = {
  categoryPlaylists: Record<string, string | null>;
  generalPlaylistId: string | null;
};

