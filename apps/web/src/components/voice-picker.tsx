import { LucideIcons, StateBadge } from '@e-burgos/tucu-ui';
import { useEffect, useRef, useState } from 'react';

import { servicePathUrl } from '../api/artifact-url';
import { translateVoiceDescription, voiceQualityKey } from '../api/voice-i18n';
import type { VoiceModel } from '../api/render-api-types';
import { useLanguage, useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { SECONDARY_BUTTON_SMALL_CLASS } from './ui/cl-controls';

export type VoicePickerProps = {
  voices: readonly VoiceModel[];
  selectedId: string | null;
  onSelect: (voiceId: string) => void;
  disabled?: boolean;
};

type PreviewState = 'idle' | 'loading' | 'playing' | 'error';

export { voiceQualityKey };

const PREVIEW_BUTTON_KEY: Readonly<Record<PreviewState, TranslationKey>> = {
  idle: 'voicePicker.play',
  loading: 'voicePicker.loading',
  playing: 'voicePicker.stop',
  error: 'voicePicker.retry',
};

type VoiceCardProps = {
  voice: VoiceModel;
  selected: boolean;
  active: boolean;
  disabled: boolean;
  onSelect: (voiceId: string) => void;
  onPlay: (voiceId: string) => void;
  onStopped: () => void;
};

function VoiceCard({
  voice,
  selected,
  active,
  disabled,
  onSelect,
  onPlay,
  onStopped,
}: VoiceCardProps) {
  const t = useT();
  const { language } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewRef = useRef<PreviewState>('idle');
  const [preview, setPreview] = useState<PreviewState>('idle');

  function moveTo(next: PreviewState) {
    previewRef.current = next;
    setPreview(next);
  }

  useEffect(() => {
    if (active || previewRef.current === 'idle' || previewRef.current === 'error') {
      return;
    }
    audioRef.current?.pause();
    previewRef.current = 'idle';
    setPreview('idle');
  }, [active]);

  async function togglePreview() {
    const audio = audioRef.current;
    if (audio === null) {
      return;
    }

    if (preview === 'playing' || preview === 'loading') {
      audio.pause();
      moveTo('idle');
      onStopped();
      return;
    }

    onPlay(voice.id);
    moveTo('loading');
    try {
      await audio.play();
    } catch {
      moveTo('error');
    }
  }

  const qualityKey = voiceQualityKey(voice.quality ?? null);
  const quality = qualityKey === null ? null : t(qualityKey);

  return (
    <li
      data-testid="voice-card"
      data-voice-id={voice.id}
      data-selected={selected ? 'true' : 'false'}
      data-preview-state={preview}
      className={`glass-sub min-w-0 flex flex-col gap-2 rounded-[14px] p-3 ${
        selected ? 'border-[var(--cl-action)] ring-2 ring-[var(--cl-action-ring)]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <label className="flex min-w-0 items-start gap-2">
          <input
            type="radio"
            name="voice-model"
            value={voice.id}
            checked={selected}
            disabled={disabled}
            aria-label={t('voicePicker.use', { label: voice.label })}
            onChange={() => onSelect(voice.id)}
            className="mt-1 accent-[var(--cl-action-fill)]"
          />
          <span className="min-w-0 flex flex-col gap-0.5">
            <span className="block text-sm font-bold text-[var(--cl-ink)]">{voice.label}</span>
            <span className="font-data block text-xs text-[var(--cl-ink-2)]">
              {voice.language.code}
              {quality === null ? '' : ` · ${quality}`}
              {voice.isDefault ? ` · ${t('voicePicker.default')}` : ''}
            </span>
            {voice.engine === 'elevenlabs' && (
              <span className="mt-1 block">
                <StateBadge tone="orange" size="sm" data-testid="voice-engine-badge">
                  {t('voicePicker.elevenlabsBadge')}
                </StateBadge>
              </span>
            )}
          </span>
        </label>

        <button
          type="button"
          aria-label={t('voicePicker.preview', { label: voice.label })}
          onClick={() => void togglePreview()}
          className={`${SECONDARY_BUTTON_SMALL_CLASS} shrink-0`}
        >
          {preview === 'playing' ? (
            <LucideIcons.Square aria-hidden size={12} />
          ) : (
            <LucideIcons.Play aria-hidden size={12} />
          )}
          {t(PREVIEW_BUTTON_KEY[preview])}
        </button>
      </div>

      <p className="m-0 text-xs text-[var(--cl-ink-2)]">{translateVoiceDescription(voice, language, t)}</p>

      {preview === 'error' && (
        <p data-testid="voice-preview-error" className="font-data m-0 text-xs text-[var(--tucu-state-orange-ink)]">
          {t('voicePicker.previewFailed')}
        </p>
      )}

      <audio
        ref={audioRef}
        data-testid="voice-preview-audio"
        data-voice-id={voice.id}
        preload="none"
        src={servicePathUrl(voice.previewUrl)}
        onPlaying={() => moveTo('playing')}
        onEnded={() => {
          moveTo('idle');
          onStopped();
        }}
        onError={() => moveTo('error')}
      >
        <track kind="captions" />
      </audio>
    </li>
  );
}

export function VoicePicker({ voices, selectedId, onSelect, disabled = false }: VoicePickerProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const t = useT();

  return (
    <ul
      data-testid="voice-picker"
      aria-label={t('voice.pickerLabel')}
      className="m-0 grid list-none gap-3 p-0 min-[1100px]:grid-cols-2"
    >
      {voices.map((voice) => (
        <VoiceCard
          key={voice.id}
          voice={voice}
          selected={voice.id === selectedId}
          active={voice.id === activeId}
          disabled={disabled}
          onSelect={onSelect}
          onPlay={setActiveId}
          onStopped={() => setActiveId(null)}
        />
      ))}
    </ul>
  );
}
