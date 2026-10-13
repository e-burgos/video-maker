import type { SettingsRepository } from '@video-maker/local-store';

export const PUBLISH_QUEUE_SETTINGS_KEY = 'youtube.queue';
export const CATEGORY_PLAYLISTS_SETTINGS_KEY = 'youtube.categoryPlaylists';
export const GENERAL_PLAYLIST_SETTINGS_KEY = 'youtube.generalPlaylistId';

export const DEFAULT_DAILY_PUBLISH_LIMIT = 10;
export const MIN_DAILY_PUBLISH_LIMIT = 1;
export const MAX_DAILY_PUBLISH_LIMIT = 100;

export interface PublishQueueSettings {
  readonly paused: boolean;
  readonly dailyLimit: number;
}

export interface CategoryPlaylistSettings {
  readonly categoryPlaylists: Readonly<Record<string, string>>;
  readonly generalPlaylistId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readPublishQueueSettings(settings: SettingsRepository): PublishQueueSettings {
  const stored = settings.get(PUBLISH_QUEUE_SETTINGS_KEY);
  if (!isRecord(stored)) {
    return { paused: true, dailyLimit: DEFAULT_DAILY_PUBLISH_LIMIT };
  }
  return {
    paused: stored.paused !== false,
    dailyLimit: typeof stored.dailyLimit === 'number' ? stored.dailyLimit : DEFAULT_DAILY_PUBLISH_LIMIT,
  };
}

export function writePublishQueueSettings(settings: SettingsRepository, value: PublishQueueSettings): void {
  settings.set(PUBLISH_QUEUE_SETTINGS_KEY, value);
}

export function readCategoryPlaylistSettings(settings: SettingsRepository): CategoryPlaylistSettings {
  const stored = settings.get(CATEGORY_PLAYLISTS_SETTINGS_KEY);
  const general = settings.get(GENERAL_PLAYLIST_SETTINGS_KEY);
  const categoryPlaylists: Record<string, string> = {};
  if (isRecord(stored)) {
    for (const [categoryId, playlistId] of Object.entries(stored)) {
      if (typeof playlistId === 'string' && playlistId !== '') {
        categoryPlaylists[categoryId] = playlistId;
      }
    }
  }
  return { categoryPlaylists, generalPlaylistId: typeof general === 'string' && general !== '' ? general : null };
}

export function writeCategoryPlaylistSettings(settings: SettingsRepository, value: CategoryPlaylistSettings): void {
  settings.set(CATEGORY_PLAYLISTS_SETTINGS_KEY, value.categoryPlaylists);
  if (value.generalPlaylistId === null) {
    settings.delete(GENERAL_PLAYLIST_SETTINGS_KEY);
    return;
  }
  settings.set(GENERAL_PLAYLIST_SETTINGS_KEY, value.generalPlaylistId);
}
