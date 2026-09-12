import { useCallback, useState } from 'react';
import type { LogoOverlay, LogoPosition } from '@video-maker/timeline-core';

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
import type { AssetListing } from '../api/render-api-types';

export type LogoOverlayEditorProps = {
  slug: string;
  logo?: LogoOverlay;
  dispatch: (action: TimelineEditAction) => void;
};

export function LogoOverlayEditor({ slug, logo, dispatch }: LogoOverlayEditorProps) {
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
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex flex-wrap items-center gap-4">
        <label
          className="flex items-center gap-2 text-sm text-slate-300"
          title={blockers[0] === undefined ? '' : t(blockers[0].key, blockers[0].params)}
        >
          <input
            type="checkbox"
            aria-label={t('logo.show')}
            checked={shown}
            disabled={asset === undefined}
            onChange={(event) => toggle(event.target.checked)}
          />
          {t('logo.show')}
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-400">
          {t('logo.position')}
          <select
            aria-label={t('logo.position')}
            value={position}
            disabled={asset === undefined}
            onChange={(event) => move(event.target.value as LogoPosition)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200 disabled:opacity-40"
          >
            {LOGO_POSITIONS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-400">
          {t('logo.size')}
          <select
            aria-label={t('logo.size')}
            value={logo === undefined ? 'medium' : logoSizeOf(logo.widthRatio)}
            disabled={!shown}
            onChange={(event) => resize(event.target.value as LogoSize)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200 disabled:opacity-40"
          >
            {LOGO_SIZES.map((size) => (
              <option key={size} value={size}>
                {t(`logo.size.${size}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-400">
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
            className="disabled:opacity-40"
          />
          <span data-testid="logo-opacity-value" className="font-mono text-xs text-slate-500">
            {Math.round((logo?.opacity ?? 1) * 100)}
          </span>
        </label>

        {asset !== undefined && (
          <span data-testid="logo-asset" className="font-mono text-xs text-slate-500">
            {asset.path}
          </span>
        )}
      </div>

      {opaqueLogos.length > 0 && (
        <ul data-testid="logo-no-alpha" className="space-y-0.5 font-mono text-xs text-amber-300">
          {opaqueLogos.map((path) => (
            <li key={path}>
              {path} — {t('logo.noAlpha')}
            </li>
          ))}
        </ul>
      )}

      {blockers.length > 0 && (
        <ul data-testid="logo-blockers" className="space-y-0.5 font-mono text-xs text-amber-300">
          {blockers.map((blocker) => (
            <li key={blockerId(blocker)}>{t(blocker.key, blocker.params)}</li>
          ))}
        </ul>
      )}

      <AssetUploader
        slug={slug}
        roles={['logo']}
        fileInputLabel={t('logo.fileLabel')}
        onUploaded={assets.reload}
      />
    </div>
  );
}
