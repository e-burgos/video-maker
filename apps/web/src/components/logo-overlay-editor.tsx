import { useCallback, useState } from 'react';
import type { LogoOverlay, LogoPosition } from '@video-maker/timeline-core';

import { useRenderApi } from '../api/render-api-context';
import {
  DEFAULT_LOGO_POSITION,
  LOGO_POSITIONS,
  logoAssetsOf,
  logoBlockers,
} from '../api/timeline-edit/logo-overlay';
import type { TimelineEditAction } from '../api/timeline-edit/timeline-edit-state';
import { useAsyncResource } from '../hooks/use-async-resource';
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

  const candidates = logoAssetsOf(assets.data);
  const blockers = assets.status === 'loading' ? [] : logoBlockers(assets.data);
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

  return (
    <div
      data-testid="logo-overlay-editor"
      data-logo-shown={shown}
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-300" title={blockers[0] ?? ''}>
          <input
            type="checkbox"
            aria-label="Show logo"
            checked={shown}
            disabled={asset === undefined}
            onChange={(event) => toggle(event.target.checked)}
          />
          Show logo
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-400">
          Logo position
          <select
            aria-label="Logo position"
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

        {asset !== undefined && (
          <span data-testid="logo-asset" className="font-mono text-xs text-slate-500">
            {asset.path}
          </span>
        )}
      </div>

      {blockers.length > 0 && (
        <ul data-testid="logo-blockers" className="space-y-0.5 font-mono text-xs text-amber-300">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}

      <AssetUploader
        slug={slug}
        roles={['logo']}
        fileInputLabel="Logo image"
        onUploaded={assets.reload}
      />
    </div>
  );
}
