import type { TranslationKey } from '../i18n/messages-en';

const EXPLAINED_CODES = [
  'SERVICE_UNREACHABLE',
  'RESPONSE_NOT_JSON',
  'RESPONSE_SHAPE_UNEXPECTED',
  'TIMELINE_NOT_FOUND',
  'TIMELINE_ALREADY_EXISTS',
  'ASSET_IN_USE',
  'ASSET_NOT_FOUND',
  'JOB_INTERRUPTED',
  'JOB_NOT_RETRYABLE',
  'JOB_RECORD_INVALID',
  'OPENROUTER_KEY_INVALID',
  'OPENROUTER_FREE_QUOTA_EXHAUSTED',
  'SECRET_STORE_UNAVAILABLE',
  'PRODUCER_MODEL_INVALID',
  'BRAND_EXISTS',
  'BRAND_READ_ONLY',
  'BRAND_MANIFEST_INVALID',
  'BRAND_FONT_DOWNLOAD_FAILED',
  'BRAND_LOGO_RASTERIZE_FAILED',
  'BRAND_FONT_UNKNOWN',
  'YOUTUBE_NOT_CONNECTED',
  'YOUTUBE_CLIENT_MISSING',
  'YOUTUBE_UPLOAD_FAILED',
  'YOUTUBE_QUOTA_EXCEEDED',
  'PUBLISH_FILE_INVALID',
] as const;

type ExplainedCode = (typeof EXPLAINED_CODES)[number];

function isExplainedCode(code: string): code is ExplainedCode {
  return (EXPLAINED_CODES as readonly string[]).includes(code);
}

export function errorExplanationKey(code: string): TranslationKey | null {
  return isExplainedCode(code) ? (`error.${code}` as TranslationKey) : null;
}
