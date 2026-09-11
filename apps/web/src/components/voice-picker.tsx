import { useEffect, useRef, useState } from 'react';

import { servicePathUrl } from '../api/artifact-url';
import type { VoiceModel, VoiceQuality } from '../api/render-api-types';

export type VoicePickerProps = {
  voices: readonly VoiceModel[];
  selectedId: string | null;
  onSelect: (voiceId: string) => void;
  disabled?: boolean;
};

type PreviewState = 'idle' | 'loading' | 'playing' | 'error';

const QUALITY_LABELS: Readonly<Record<VoiceQuality, string>> = {
  x_low: 'very low quality',
  low: 'low quality',
  medium: 'medium quality',
  high: 'high quality',
};

export function voiceQualityLabel(quality: VoiceQuality | null): string | null {
  return quality === null ? null : QUALITY_LABELS[quality];
}

const PREVIEW_BUTTON_LABEL: Readonly<Record<PreviewState, string>> = {
  idle: 'Play',
  loading: 'Loading…',
  playing: 'Stop',
  error: 'Retry',
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

  const quality = voiceQualityLabel(voice.quality);

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
            aria-label={`Use ${voice.label}`}
            onChange={() => onSelect(voice.id)}
            className="mt-1"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold text-slate-100">{voice.label}</span>
            <span className="block font-mono text-xs text-slate-500">
              {voice.language.code}
              {quality === null ? '' : ` · ${quality}`}
              {voice.isDefault ? ' · default' : ''}
            </span>
          </span>
        </label>

        <button
          type="button"
          aria-label={`Preview ${voice.label}`}
          onClick={() => void togglePreview()}
          className="shrink-0 rounded-md border border-slate-700 px-2 py-1 font-mono text-xs text-slate-200"
        >
          {preview === 'playing' ? '■' : '▶'} {PREVIEW_BUTTON_LABEL[preview]}
        </button>
      </div>

      <p className="text-xs text-slate-400">{voice.description}</p>

      {preview === 'error' && (
        <p data-testid="voice-preview-error" className="font-mono text-xs text-amber-300">
          This voice could not be synthesized on this machine. Check that Piper is installed.
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
