import { useId, useRef, useState } from 'react';

import { BROLL_MATCHING_HINT_KEY, assetRoleCopy, orderedAssetRoles } from '../api/asset-roles';
import { ASSET_ROLES } from '../api/render-api-types';
import { assetContentType } from '../api/asset-media-kind';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import type { AssetListEntry, AssetRole } from '../api/render-api-types';

export type AssetUploaderProps = {
  slug: string;
  onUploaded: (entry: AssetListEntry) => void;
  roles?: readonly AssetRole[];
  fileInputLabel?: string;
};

export function AssetUploader({ slug, onUploaded, roles, fileInputLabel }: AssetUploaderProps) {
  const client = useRenderApi();
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const offered = roles ?? ASSET_ROLES;
  const [role, setRole] = useState<AssetRole>(offered[0] ?? 'aroll');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [error, setError] = useState<RenderApiError | null>(null);
  const t = useT();

  async function upload(file: File) {
    setError(null);
    setUploaded(null);
    setUploading(true);
    try {
      const entry = await client.uploadAsset({
        slug,
        role,
        filename: file.name,
        contentType: file.type === '' ? assetContentType(file.name) : file.type,
        body: file,
      });
      setUploaded(entry.path);
      onUploaded(entry);
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setUploading(false);
      if (inputRef.current !== null) {
        inputRef.current.value = '';
      }
    }
  }

  const choices = orderedAssetRoles(offered);
  const showsBrollHint = choices.some((choice) => choice.role === 'broll' || choice.role === 'image');

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      {offered.length === 1 ? (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={`${fieldId}-role`} className="text-sm text-slate-400">
            {t('assetRole.legend')}
          </label>
          <span id={`${fieldId}-role`} className="font-mono text-sm text-slate-100">
            {role}
          </span>
          <span className="text-xs text-slate-500">{t(assetRoleCopy(role).impactKey)}</span>
        </div>
      ) : (
        <fieldset data-testid="asset-role-choices" className="space-y-2">
          <legend className="text-sm text-slate-400">{t('assetRole.legend')}</legend>
          <ul className="grid gap-2 sm:grid-cols-2">
            {choices.map((choice) => (
              <li
                key={choice.role}
                data-testid="asset-role-choice"
                data-role={choice.role}
                data-selected={choice.role === role ? 'true' : 'false'}
                className={`rounded-lg border p-3 ${
                  choice.role === role
                    ? 'border-sky-500/60 bg-sky-500/10'
                    : 'border-slate-800 bg-slate-900/40'
                }`}
              >
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name={`${fieldId}-role`}
                    value={choice.role}
                    checked={choice.role === role}
                    disabled={uploading}
                    aria-label={t('assetRole.chooseAria', { name: t(choice.nameKey) })}
                    onChange={() => setRole(choice.role)}
                    className="mt-1"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-semibold text-slate-100">
                      {t(choice.nameKey)}
                      {choice.required && (
                        <span
                          data-testid="asset-role-required"
                          className="ml-2 rounded-sm border border-amber-500/50 px-1 font-mono text-[10px] uppercase text-amber-300"
                        >
                          {t('assetRole.required')}
                        </span>
                      )}
                    </span>
                    <span className="block font-mono text-[11px] text-slate-500">
                      {t('assetRole.directory', { role: choice.role })}
                    </span>
                    <span className="block text-xs text-slate-400">{t(choice.impactKey)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {showsBrollHint && (
            <p data-testid="asset-role-hint" className="text-xs text-slate-500">
              {t(BROLL_MATCHING_HINT_KEY)}
            </p>
          )}
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id={`${fieldId}-file`}
          type="file"
          aria-label={fileInputLabel ?? t('assetUploader.fileLabel')}
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) {
              void upload(file);
            }
          }}
          className="text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:text-slate-200"
        />
        {uploading && <span className="text-sm text-slate-400">{t('assetUploader.uploading')}</span>}
      </div>
      {uploaded !== null && (
        <p role="status" className="font-mono text-xs text-emerald-300">
          {t('assetUploader.stored', { path: uploaded })}
        </p>
      )}
      {error !== null && <ErrorNotice error={error} />}
    </div>
  );
}
