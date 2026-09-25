import type { TranslationKey } from '../i18n/messages-en';

const CATEGORY_KEY_BY_ID: Readonly<Record<string, TranslationKey>> = {
  ffmpeg: 'health.category.video',
  ffprobe: 'health.category.video',
  whisperCli: 'health.category.transcription',
  whisperModel: 'health.category.transcription',
  ttsCli: 'health.category.voice',
  ttsVoicesDir: 'health.category.voice',
};

const FALLBACK_CATEGORY_KEY: TranslationKey = 'health.engine';

export function healthCategoryKey(id: string): TranslationKey {
  return CATEGORY_KEY_BY_ID[id] ?? FALLBACK_CATEGORY_KEY;
}

export function dedupeHealthCategoryKeys(ids: readonly string[]): TranslationKey[] {
  const seen = new Set<TranslationKey>();
  const ordered: TranslationKey[] = [];
  for (const id of ids) {
    const key = healthCategoryKey(id);
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }
  return ordered;
}
