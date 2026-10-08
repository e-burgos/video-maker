import { useCallback } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useSectionDraft } from '../hooks/use-section-draft';
import type { BrandEditor } from '../hooks/use-brand-editor';
import { useT } from '../i18n/language-context';
import { BrandField } from './brand-field';
import { BrandSaveBar } from './brand-save-bar';
import { ErrorNotice } from './error-notice';
import { VoicePicker } from './voice-picker';

export const VOICE_SPEED_MIN = 0.7;
export const VOICE_SPEED_MAX = 1.4;

export function BrandVoiceSection({ editor }: { editor: BrandEditor }) {
  const t = useT();
  const client = useRenderApi();
  const voices = useAsyncResource(useCallback(() => client.listVoices(), [client]), 'brand-voices');
  const saved = {
    id: editor.manifest?.voice.id ?? '',
    lengthScale: editor.manifest?.voice.lengthScale ?? 1,
  };
  const { draft, setDraft, dirty } = useSectionDraft(saved);

  return (
    <div data-testid="brand-section-voice" className="space-y-4">
      <p className="text-sm text-ink-muted">{t('brands.voice.hint')}</p>
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
          className="w-full max-w-sm"
        />
      </BrandField>
      <BrandSaveBar
        editor={editor}
        dirty={dirty}
        testId="brand-voice-save"
        onSave={() => void editor.update((current) => ({ ...current, voice: draft }), 'silent')}
      />
    </div>
  );
}
