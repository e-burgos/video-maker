import { useEffect, useRef, useState } from 'react';

import { servicePathUrl } from '../api/artifact-url';
import { translateVoiceDescription, voiceQualityKey } from '../api/voice-i18n';
import type { VoiceModel } from '../api/render-api-types';
import { useLanguage, useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';

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
      className={`space-y-2 rounded-lg border p-3 ${
        selected ? 'border-sky-500/60 bg-sky-500/10' : 'border-slate-800 bg-slate-900/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="voice-model"
            value={voice.id}
            checked={selected}
            disabled={disabled}
            aria-label={t('voicePicker.use', { label: voice.label })}
            onChange={() => onSelect(voice.id)}
            className="mt-1"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold text-slate-100">{voice.label}</span>
            <span className="block font-mono text-xs text-slate-500">
              {voice.language.code}
              {quality === null ? '' : ` · ${quality}`}
              {voice.isDefault ? ` · ${t('voicePicker.default')}` : ''}
            </span>
            {voice.engine === 'elevenlabs' && (
              <span
                data-testid="voice-engine-badge"
                className="mt-1 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-200"
              >
                {t('voicePicker.elevenlabsBadge')}
              </span>
            )}
          </span>
        </label>

        <button
          type="button"
          aria-label={t('voicePicker.preview', { label: voice.label })}
          onClick={() => void togglePreview()}
          className="shrink-0 rounded-md border border-slate-700 px-2 py-1 font-mono text-xs text-slate-200"
        >
          {preview === 'playing' ? '■' : '▶'} {t(PREVIEW_BUTTON_KEY[preview])}
        </button>
      </div>

      <p className="text-xs text-slate-400">{translateVoiceDescription(voice, language, t)}</p>

      {preview === 'error' && (
        <p data-testid="voice-preview-error" className="font-mono text-xs text-amber-300">
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

  return (
    <ul data-testid="voice-picker" className="grid gap-2 sm:grid-cols-2">
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
