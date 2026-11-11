import type { LogoBumper, TimelineBumpers } from '@video-maker/timeline-core';

import {
  AUTO_CHOICE,
  BUMPER_BACKDROPS,
  BUMPER_DURATIONS_MS,
  BUMPER_REVEALS,
  BUMPER_SFX_CHOICES,
  MAX_BUMPER_CAPTION_LENGTH,
  backdropChoiceOf,
  revealChoiceOf,
  sfxChoiceOf,
  styleForBackdropChoice,
  styleForCaption,
  styleForRevealChoice,
  styleForSfxChoice,
  BUMPER_EDGES,
  BUMPER_LOGO_SIZES,
  BUMPER_LOGO_WIDTH_RATIO_BY_SIZE,
  bumperLogoSizeOf,
  isBumperColor,
} from '../api/timeline-edit/logo-bumpers';
import type { BumperEdge, BumperLogoSize, BumperStyle } from '../api/timeline-edit/logo-bumpers';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';
import type { TranslateFn } from '../i18n/language-context';

export type LogoBumperEditorProps = {
  bumpers?: TimelineBumpers;
  logoAvailable: boolean;
  dispatch: (action: TimelineEditAction) => void;
};

type BumperSettingsProps = {
  edge: BumperEdge;
  bumper: LogoBumper;
  rotating: boolean;
  dispatch: (action: TimelineEditAction) => void;
  t: TranslateFn;
};

function durationLabel(durationMs: number, t: TranslateFn): string {
  return t('bumper.durationOption', { seconds: (durationMs / 1000).toFixed(1) });
}

const SELECT_CLASS = 'rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200';

function BumperSettings({ edge, bumper, rotating, dispatch, t }: BumperSettingsProps) {
  function restyle(style: BumperStyle) {
    dispatch({ type: 'bumper-style', edge, style });
  }

  return (
    <div
      data-testid={`bumper-settings-${edge}`}
      className="flex flex-wrap items-center gap-4 border-l border-slate-800 pl-4"
    >
      <label className="flex items-center gap-2 text-xs text-slate-400">
        {t('bumper.background')}
        <input
          type="color"
          aria-label={t(`bumper.background.${edge}`)}
          value={bumper.backgroundColor}
          onChange={(event) => restyle({ backgroundColor: event.target.value })}
          className="h-7 w-10 rounded border border-slate-700 bg-slate-900"
        />
        <input
          type="text"
          aria-label={t(`bumper.backgroundHex.${edge}`)}
          value={bumper.backgroundColor}
          onChange={(event) => {
            const next = event.target.value;
            if (isBumperColor(next)) {
              restyle({ backgroundColor: next });
            }
          }}
          className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-400">
        {t('bumper.duration')}
        <select
          aria-label={t(`bumper.duration.${edge}`)}
          value={bumper.durationMs}
          onChange={(event) => restyle({ durationMs: Number(event.target.value) })}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
        >
          {BUMPER_DURATIONS_MS.map((durationMs) => (
            <option key={durationMs} value={durationMs}>
              {durationLabel(durationMs, t)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-400">
        {t('bumper.animation')}
        <select
          aria-label={t(`bumper.animation.${edge}`)}
          value={revealChoiceOf(bumper, rotating)}
          onChange={(event) => restyle(styleForRevealChoice(event.target.value))}
          className={SELECT_CLASS}
        >
          {rotating && <option value={AUTO_CHOICE}>{t('bumper.auto')}</option>}
          {BUMPER_REVEALS.map((reveal) => (
            <option key={reveal} value={reveal}>
              {t(`bumper.animation.${reveal}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-400">
        {t('bumper.backdrop')}
        <select
          aria-label={t(`bumper.backdrop.${edge}`)}
          value={backdropChoiceOf(bumper, rotating)}
          onChange={(event) => restyle(styleForBackdropChoice(event.target.value))}
          className={SELECT_CLASS}
        >
          {rotating && <option value={AUTO_CHOICE}>{t('bumper.auto')}</option>}
          {BUMPER_BACKDROPS.map((backdrop) => (
            <option key={backdrop} value={backdrop}>
              {t(`bumper.backdrop.${backdrop}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-400">
        {t('bumper.sfx')}
        <select
          aria-label={t(`bumper.sfx.${edge}`)}
          value={sfxChoiceOf(bumper, rotating)}
          onChange={(event) => restyle(styleForSfxChoice(event.target.value))}
          className={SELECT_CLASS}
        >
          {rotating && <option value={AUTO_CHOICE}>{t('bumper.auto')}</option>}
          {BUMPER_SFX_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {t(`bumper.sfx.${choice}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-400">
        {t('bumper.caption')}
        <input
          type="text"
          aria-label={t(`bumper.caption.${edge}`)}
          value={bumper.caption ?? ''}
          maxLength={MAX_BUMPER_CAPTION_LENGTH}
          placeholder={t('bumper.captionPlaceholder')}
          onChange={(event) => restyle(styleForCaption(event.target.value))}
          className="w-44 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-400">
        {t('bumper.logoSize')}
        <select
          aria-label={t(`bumper.logoSize.${edge}`)}
          value={bumperLogoSizeOf(bumper.logoWidthRatio)}
          onChange={(event) =>
            restyle({
              logoWidthRatio: BUMPER_LOGO_WIDTH_RATIO_BY_SIZE[event.target.value as BumperLogoSize],
            })
          }
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
        >
          {BUMPER_LOGO_SIZES.map((size) => (
            <option key={size} value={size}>
              {t(`bumper.logoSize.${size}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function LogoBumperEditor({ bumpers, logoAvailable, dispatch }: LogoBumperEditorProps) {
  const t = useT();

  return (
    <div data-testid="logo-bumper-editor" className="space-y-3">
      {BUMPER_EDGES.map((edge) => {
        const bumper = bumpers?.[edge];
        const enabled = bumper?.enabled === true;

        return (
          <div key={edge} className="space-y-2">
            <label
              className="flex items-center gap-2 text-sm text-slate-300"
              title={logoAvailable ? '' : t('bumper.needsLogo')}
            >
              <input
                type="checkbox"
                aria-label={t(`bumper.enable.${edge}`)}
                checked={enabled}
                disabled={!logoAvailable}
                onChange={(event) => dispatch({ type: 'bumper-enabled', edge, enabled: event.target.checked })}
              />
              {t(`bumper.enable.${edge}`)}
            </label>

            {enabled && bumper !== undefined && (
              <BumperSettings
                edge={edge}
                bumper={bumper}
                rotating={bumpers?.style?.rotate === true}
                dispatch={dispatch}
                t={t}
              />
            )}
          </div>
        );
      })}

      {!logoAvailable && (
        <p data-testid="bumper-needs-logo" className="font-mono text-xs text-amber-300">
          {t('bumper.needsLogo')}
        </p>
      )}
    </div>
  );
}
