import { useCallback, useState } from 'react';
import type { LogoOverlay, LogoPosition, TimelineBumpers } from '@video-maker/timeline-core';

import { useRenderApi } from '../api/render-api-context';
import {
  DEFAULT_LOGO_POSITION,
  LOGO_POSITIONS,
  LOGO_SIZES,
  LOGO_WIDTH_RATIO_BY_SIZE,
  logoAssetsOf,
  logoAssetsWithoutAlpha,
  logoBlockers,
  logoSizeOf,
} from '../api/timeline-edit/logo-overlay';
import type { LogoSize } from '../api/timeline-edit/logo-overlay';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { blockerId } from '../api/blockers';
import { AssetUploader } from './asset-uploader';
import { LogoBumperEditor } from './logo-bumper-editor';
import { CHECKBOX_CLASS, CHECK_LABEL_CLASS, FIELD_SMALL_CLASS, INLINE_LABEL_CLASS, WARNING_LIST_CLASS } from './ui/cl-controls';
import type { AssetListing } from '../api/render-api-types';

export type LogoOverlayEditorProps = {
  slug: string;
  logo?: LogoOverlay;
  bumpers?: TimelineBumpers;
  dispatch: (action: TimelineEditAction) => void;
};

export function LogoOverlayEditor({ slug, logo, bumpers, dispatch }: LogoOverlayEditorProps) {
  const client = useRenderApi();
  const load = useCallback(() => client.listAssets(slug), [client, slug]);
  const assets = useAsyncResource<AssetListing>(load, `assets:${slug}`);
  const [position, setPosition] = useState<LogoPosition>(logo?.position ?? DEFAULT_LOGO_POSITION);
  const t = useT();

  const candidates = logoAssetsOf(assets.data);
  const blockers = assets.status === 'loading' ? [] : logoBlockers(assets.data);
  const opaqueLogos = logoAssetsWithoutAlpha(assets.data);
  const asset = candidates[0];
  const shown = logo !== undefined;

  function toggle(next: boolean) {
    if (!next) {
      dispatch({ type: 'logo-clear' });
      return;
    }
    if (asset !== undefined) {
      dispatch({ type: 'logo-set', asset, position });
    }
  }

  function move(next: LogoPosition) {
    setPosition(next);
    if (shown && asset !== undefined) {
      dispatch({ type: 'logo-set', asset, position: next });
    }
  }

  function resize(size: LogoSize) {
    dispatch({
      type: 'logo-style',
      widthRatio: LOGO_WIDTH_RATIO_BY_SIZE[size],
      opacity: logo?.opacity ?? 1,
    });
  }

  function fade(opacity: number) {
    dispatch({ type: 'logo-style', widthRatio: logo?.widthRatio ?? 0.18, opacity });
  }

  return (
    <div
      data-testid="logo-overlay-editor"
      data-logo-shown={shown}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-3">
        <label
          className={CHECK_LABEL_CLASS}
          title={blockers[0] === undefined ? '' : t(blockers[0].key, blockers[0].params)}
        >
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            aria-label={t('logo.show')}
            checked={shown}
            disabled={asset === undefined}
            onChange={(event) => toggle(event.target.checked)}
          />
          {t('logo.show')}
        </label>

        <label className={`${INLINE_LABEL_CLASS} justify-between`}>
          {t('logo.position')}
          <select
            aria-label={t('logo.position')}
            value={position}
            disabled={asset === undefined}
            onChange={(event) => move(event.target.value as LogoPosition)}
            className={`${FIELD_SMALL_CLASS} font-data disabled:opacity-50`}
          >
            {LOGO_POSITIONS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>

        <label className={`${INLINE_LABEL_CLASS} justify-between`}>
          {t('logo.size')}
          <select
            aria-label={t('logo.size')}
            value={logo === undefined ? 'medium' : logoSizeOf(logo.widthRatio)}
            disabled={!shown}
            onChange={(event) => resize(event.target.value as LogoSize)}
            className={`${FIELD_SMALL_CLASS} font-data disabled:opacity-50`}
          >
            {LOGO_SIZES.map((size) => (
              <option key={size} value={size}>
                {t(`logo.size.${size}`)}
              </option>
            ))}
          </select>
        </label>

        <label className={`${INLINE_LABEL_CLASS} justify-between`}>
          {t('logo.opacity')}
          <input
            type="range"
            aria-label={t('logo.opacity')}
            min={10}
            max={100}
            step={5}
            value={Math.round((logo?.opacity ?? 1) * 100)}
            disabled={!shown}
            onChange={(event) => fade(Number(event.target.value) / 100)}
            className="accent-[var(--cl-action-fill)] disabled:opacity-50"
          />
          <span data-testid="logo-opacity-value" className="font-data w-8 text-right text-xs text-[var(--cl-ink-2)]">
            {Math.round((logo?.opacity ?? 1) * 100)}
          </span>
        </label>

        {asset !== undefined && (
          <span data-testid="logo-asset" className="font-data truncate text-xs text-[var(--cl-ink-3)]">
            {asset.path}
          </span>
        )}
      </div>

      {opaqueLogos.length > 0 && (
        <ul data-testid="logo-no-alpha" className={WARNING_LIST_CLASS}>
          {opaqueLogos.map((path) => (
            <li key={path}>
              {path} — {t('logo.noAlpha')}
            </li>
          ))}
        </ul>
      )}

      {blockers.length > 0 && (
        <ul data-testid="logo-blockers" className={WARNING_LIST_CLASS}>
          {blockers.map((blocker) => (
            <li key={blockerId(blocker)}>{t(blocker.key, blocker.params)}</li>
          ))}
        </ul>
      )}

      <LogoBumperEditor
        {...(bumpers === undefined ? {} : { bumpers })}
        logoAvailable={shown}
        dispatch={dispatch}
      />

      <AssetUploader
        slug={slug}
        roles={['logo']}
        fileInputLabel={t('logo.fileLabel')}
        onUploaded={assets.reload}
      />
    </div>
  );
}
