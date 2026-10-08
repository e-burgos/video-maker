export const YOUTUBE_CLIENT_ID_SECRET = 'youtube-oauth-client-id';
export const YOUTUBE_CLIENT_SECRET_SECRET = 'youtube-oauth-client-secret';
export const YOUTUBE_REFRESH_TOKEN_SECRET = 'youtube-oauth-refresh-token';
export const YOUTUBE_CHANNEL_SETTING_KEY = 'youtube.channel';
export const YOUTUBE_UPLOAD_SETTING_PREFIX = 'youtube.upload.';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_UPLOAD_API_URL = 'https://www.googleapis.com/upload/youtube/v3';

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
] as const;

export const OAUTH_CONNECT_TIMEOUT_MS = 5 * 60 * 1000;
export const GOOGLE_API_TIMEOUT_MS = 30_000;
export const GOOGLE_UPLOAD_CHUNK_TIMEOUT_MS = 10 * 60 * 1000;
export const GOOGLE_RESPONSE_LIMIT_BYTES = 1024 * 1024;
export const YOUTUBE_DEFAULT_CATEGORY_ID = '22';
export const YOUTUBE_DEFAULT_LANGUAGE = 'es';
export const SHORT_MAX_DURATION_SEC = 180;
