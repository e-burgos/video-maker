import { useCallback } from 'react';

import { useRenderApi } from '../../api/render-api-context';
import type { BrandVoice } from '../../api/brand-types';
import { useAsyncResource } from '../../hooks/use-async-resource';
import type { BrandEditor } from '../../hooks/use-brand-editor';
import type { SectionDraft } from '../../hooks/use-section-draft';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { VoicePicker } from '../voice-picker';
import { BRAND_HINT_CLASS } from './brand-controls';
import { BrandField } from './brand-field';

export const VOICE_SPEED_MIN = 0.7;
export const VOICE_SPEED_MAX = 1.4;

export type BrandVoiceSectionProps = { editor: BrandEditor; draft: SectionDraft<BrandVoice> };

export function BrandVoiceSection({ editor, draft: { draft, setDraft } }: BrandVoiceSectionProps) {
  const t = useT();
  const client = useRenderApi();
  const voices = useAsyncResource(useCallback(() => client.listVoices(), [client]), 'brand-voices');

  return (
    <div data-testid="brand-section-voice" className="flex flex-col gap-4">
      <p className={BRAND_HINT_CLASS}>{t('brands.voice.hint')}</p>
      {voices.status === 'error' && voices.error !== null && (
        <ErrorNotice error={voices.error} onRetry={voices.reload} />
      )}
      {voices.data !== null && (
        <VoicePicker
          voices={voices.data.voices}
          selectedId={draft.id}
          onSelect={(id) => setDraft((current) => ({ ...current, id }))}
          disabled={editor.readOnly}
        />
      )}
      <BrandField label={t('brands.voice.speed', { value: draft.lengthScale.toFixed(2) })} hint={t('brands.voice.speedHint')}>
        <input
          type="range"
          data-testid="brand-voice-speed"
          min={VOICE_SPEED_MIN}
          max={VOICE_SPEED_MAX}
          step={0.05}
          value={draft.lengthScale}
          disabled={editor.readOnly}
          onChange={(event) => setDraft((current) => ({ ...current, lengthScale: Number(event.target.value) }))}
          className="focus-cl w-full max-w-sm accent-[var(--cl-action-fill)]"
        />
      </BrandField>
    </div>
  );
}
