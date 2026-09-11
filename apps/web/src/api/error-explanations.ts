import type { TranslationKey } from '../i18n/messages-en';

const EXPLAINED_CODES = [
  'SERVICE_UNREACHABLE',
  'RESPONSE_NOT_JSON',
  'RESPONSE_SHAPE_UNEXPECTED',
  'TIMELINE_NOT_FOUND',
  'TIMELINE_ALREADY_EXISTS',
] as const;

type ExplainedCode = (typeof EXPLAINED_CODES)[number];

function isExplainedCode(code: string): code is ExplainedCode {
  return (EXPLAINED_CODES as readonly string[]).includes(code);
}

export function errorExplanationKey(code: string): TranslationKey | null {
  return isExplainedCode(code) ? (`error.${code}` as TranslationKey) : null;
}
