import type { TextOverlay, TextOverlayKind } from '@video-maker/timeline-core';
import { MAX_TEXT_OVERLAY_EYEBROW_LENGTH, MAX_TEXT_OVERLAY_TEXT_LENGTH } from '@video-maker/timeline-core';

import {
  TEXT_OVERLAY_AUTO_VARIANT,
  TEXT_OVERLAY_EDITOR_KINDS,
  textOverlayVariantChoices,
  variantPatch,
} from '../api/timeline-edit/text-overlays';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useT } from '../i18n/language-context';
import type { TranslateFn } from '../i18n/language-context';

export type TextOverlayEditorProps = {
  overlays?: readonly TextOverlay[];
  canAdd: boolean;
  dispatch: (action: TimelineEditAction) => void;
};

const INPUT_CLASS = 'rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100';

function secondsOf(ms: number): number {
  return Math.round(ms / 100) / 10;
}

function msOf(seconds: string): number {
  return Math.max(0, Math.round(Number(seconds) * 1000));
}

function optionalText(value: string): string | undefined {
  return value.trim() === '' ? undefined : value;
}

function OverlayRow({ overlay, dispatch, t }: { overlay: TextOverlay; dispatch: TextOverlayEditorProps['dispatch']; t: TranslateFn }) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <span className="font-mono text-xs text-slate-400">{t(`textOverlay.kind.${overlay.kind}`)}</span>
      <input
        type="text"
        aria-label={t('textOverlay.text', { id: overlay.id })}
        value={overlay.text}
        maxLength={MAX_TEXT_OVERLAY_TEXT_LENGTH}
        onChange={(event) => dispatch({ type: 'text-overlay-update', id: overlay.id, patch: { text: event.target.value } })}
        className={`w-56 ${INPUT_CLASS}`}
      />
      {overlay.kind === 'kinetic-text' ? null : (
        <input
          type="text"
          aria-label={t('textOverlay.subtitle', { id: overlay.id })}
          placeholder={t('textOverlay.subtitlePlaceholder')}
          value={overlay.subtitle ?? ''}
          maxLength={MAX_TEXT_OVERLAY_TEXT_LENGTH}
          onChange={(event) =>
            dispatch({ type: 'text-overlay-update', id: overlay.id, patch: { subtitle: optionalText(event.target.value) } })
          }
          className={`w-48 ${INPUT_CLASS}`}
        />
      )}
      {overlay.kind === 'chapter-title' ? (
        <input
          type="text"
          aria-label={t('textOverlay.eyebrow', { id: overlay.id })}
          placeholder="01"
          value={overlay.eyebrow ?? ''}
          maxLength={MAX_TEXT_OVERLAY_EYEBROW_LENGTH}
          onChange={(event) =>
            dispatch({ type: 'text-overlay-update', id: overlay.id, patch: { eyebrow: optionalText(event.target.value) } })
          }
          className={`w-16 ${INPUT_CLASS}`}
        />
      ) : null}
      <label className="flex items-center gap-1 text-xs text-slate-400">
        {t('textOverlay.start')}
        <input
          type="number"
          min={0}
          step={0.1}
          value={secondsOf(overlay.startMs)}
          onChange={(event) => dispatch({ type: 'text-overlay-update', id: overlay.id, patch: { startMs: msOf(event.target.value) } })}
          className={`w-20 ${INPUT_CLASS}`}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-slate-400">
        {t('textOverlay.duration')}
        <input
          type="number"
          min={1.2}
          max={10}
          step={0.1}
          value={secondsOf(overlay.durationMs)}
          onChange={(event) =>
            dispatch({ type: 'text-overlay-update', id: overlay.id, patch: { durationMs: msOf(event.target.value) } })
          }
          className={`w-20 ${INPUT_CLASS}`}
        />
      </label>
      <select
        aria-label={t('textOverlay.variant', { id: overlay.id })}
        value={overlay.variant ?? TEXT_OVERLAY_AUTO_VARIANT}
        onChange={(event) => dispatch({ type: 'text-overlay-update', id: overlay.id, patch: variantPatch(event.target.value) })}
        className={INPUT_CLASS}
      >
        {textOverlayVariantChoices(overlay.kind).map((choice) => (
          <option key={choice} value={choice}>
            {t(`textOverlay.variant.${choice}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => dispatch({ type: 'text-overlay-remove', id: overlay.id })}
        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
      >
        {t('textOverlay.remove')}
      </button>
    </li>
  );
}

export function TextOverlayEditor({ overlays, canAdd, dispatch }: TextOverlayEditorProps) {
  const t = useT();
  const add = (kind: TextOverlayKind) => dispatch({ type: 'text-overlay-add', kind, text: t(`textOverlay.defaultText.${kind}`) });

  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {(overlays ?? []).map((overlay) => (
          <OverlayRow key={overlay.id} overlay={overlay} dispatch={dispatch} t={t} />
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {TEXT_OVERLAY_EDITOR_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={!canAdd}
            onClick={() => add(kind)}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          >
            {t('textOverlay.add', { kind: t(`textOverlay.kind.${kind}`) })}
          </button>
        ))}
      </div>
    </div>
  );
}
