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
] as const;

type ExplainedCode = (typeof EXPLAINED_CODES)[number];

function isExplainedCode(code: string): code is ExplainedCode {
  return (EXPLAINED_CODES as readonly string[]).includes(code);
}

export function errorExplanationKey(code: string): TranslationKey | null {
  return isExplainedCode(code) ? (`error.${code}` as TranslationKey) : null;
}
