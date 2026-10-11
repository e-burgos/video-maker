import type { ReviewStatus } from '@video-maker/timeline-core';
import type { PublicationStatus, RenderApiErrorPayload, RenderJobState } from './render-api-types';

export const YOUTUBE_PRIVACIES = ['public', 'unlisted', 'private'] as const;

export type YouTubePrivacy = (typeof YOUTUBE_PRIVACIES)[number];

export type YouTubeChannel = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
};

export type YouTubeIntegration = {
  clientConfigured: boolean;
  connected: boolean;
  channel: YouTubeChannel | null;
};

export type YouTubeClientCredentials = {
  clientId: string;
  clientSecret: string;
};

export type YouTubeConnectStart = {
  authUrl: string;
};

export type YouTubePublishFile = {
  path: string;
  durationSec: number;
  width: number;
  height: number;
  isShort: boolean;
  sizeBytes: number;
  reviewStatus: ReviewStatus | null;
};

export type YouTubePlaylist = {
  id: string;
  title: string;
};

export type YouTubePublishOptions = {
  files: YouTubePublishFile[];
  playlists: YouTubePlaylist[];
  defaults: { privacy: YouTubePrivacy };
};

export type YouTubeDraft = {
  title: string;
  description: string;
  tags: string[];
};

export type YouTubePublishInput = {
  file: string;
  title: string;
  description: string;
  tags: string[];
  privacy: YouTubePrivacy;
  publishAt?: string;
  playlistId?: string;
  thumbnail?: string;
  ignoreReview?: true;
};

export type Publication = {
  id: string;
  platform: string;
  file: string;
  title: string;
  videoId: string | null;
  url: string | null;
  privacy: YouTubePrivacy;
  status: PublicationStatus;
  publishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export type PublishStage = string;

export type PublishJobProgress = {
  stage: PublishStage;
  percent: number | null;
};

export type PublishJobReport = {
  videoId: string;
  url: string;
  privacy: YouTubePrivacy;
  publishAt: string | null;
  title: string;
};

export type PublishJob = {
  id: string;
  kind: 'publish';
  slug: string;
  state: RenderJobState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: PublishJobProgress | null;
  report: PublishJobReport | null;
  error: RenderApiErrorPayload | null;
};
