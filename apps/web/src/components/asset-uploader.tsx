import { useId, useRef, useState } from 'react';

import {
  BROLL_MATCHING_HINT_KEY,
  assetRoleCopy,
  orderedAssetRoles,
} from '../api/asset-roles';
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
  roleHint?: string;
};

export function AssetUploader({
  slug,
  onUploaded,
  roles,
  fileInputLabel,
  roleHint,
}: AssetUploaderProps) {
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
      setError(
        cause instanceof RenderApiError ? cause : serviceUnreachable(cause),
      );
    } finally {
      setUploading(false);
      if (inputRef.current !== null) {
        inputRef.current.value = '';
      }
    }
  }

  const choices = orderedAssetRoles(offered);
  const showsBrollHint = choices.some(
    (choice) => choice.role === 'broll' || choice.role === 'image',
  );
  const [dragging, setDragging] = useState(false);

  return (
    <div
      data-testid="asset-uploader"
      data-dragging={dragging}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file !== undefined && !uploading) {
          void upload(file);
        }
      }}
      className={`glass space-y-3 rounded-[20px] border-dashed p-4 ${dragging ? 'ring-2 ring-[var(--cl-action)]' : ''}`}
    >
      <h2 className="m-0 text-sm font-bold text-[var(--cl-ink)]">
        {t('library.upload.action')}
      </h2>
      <p className="m-0 text-xs text-[var(--cl-ink-2)]">
        {t('library.upload.dropHint')}
      </p>
      {offered.length === 1 ? (
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={`${fieldId}-role`}
            className="text-sm text-[var(--cl-ink-2)]"
          >
            {t('assetRole.legend')}
          </label>
          <span
            id={`${fieldId}-role`}
            className="font-data text-sm text-[var(--cl-ink)]"
          >
            {role}
          </span>
          <span className="text-xs text-[var(--cl-ink-2)]">
            {roleHint ?? t(assetRoleCopy(role).impactKey)}
          </span>
        </div>
      ) : (
        <fieldset
          data-testid="asset-role-choices"
          className="m-0 space-y-2 border-0 p-0"
        >
          <legend className="text-sm text-[var(--cl-ink-2)]">
            {t('assetRole.legend')}
          </legend>
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {choices.map((choice) => (
              <li
                key={choice.role}
                data-testid="asset-role-choice"
                data-role={choice.role}
                data-selected={choice.role === role ? 'true' : 'false'}
                className={`glass-sub rounded-[12px] p-3 ${choice.role === role ? 'ring-2 ring-[var(--cl-action)]' : ''}`}
              >
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name={`${fieldId}-role`}
                    value={choice.role}
                    checked={choice.role === role}
                    disabled={uploading}
                    aria-label={t('assetRole.chooseAria', {
                      name: t(choice.nameKey),
                    })}
                    onChange={() => setRole(choice.role)}
                    className="mt-1 accent-[var(--cl-action-fill)]"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-semibold text-[var(--cl-ink)]">
                      {t(choice.nameKey)}
                      {choice.required && (
                        <span
                          data-testid="asset-role-required"
                          className="font-data ml-2 rounded-md border border-[var(--tucu-state-orange-line)] bg-[var(--tucu-state-orange-soft)] px-1 text-[10px] uppercase text-[var(--tucu-state-orange-ink)]"
                        >
                          {t('assetRole.required')}
                        </span>
                      )}
                    </span>
                    <span className="font-data block text-[11px] text-[var(--cl-ink-3)]">
                      {t('assetRole.directory', { role: choice.role })}
                    </span>
                    <span className="block text-xs text-[var(--cl-ink-2)]">
                      {t(choice.impactKey)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {showsBrollHint && (
            <p
              data-testid="asset-role-hint"
              className="m-0 text-xs text-[var(--cl-ink-2)]"
            >
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
          className="focus-cl max-w-full text-sm text-[var(--cl-ink-2)] file:mr-3 file:h-8 file:cursor-pointer file:rounded-[10px] file:border-0 file:bg-[var(--cl-action-fill)] file:px-3 file:text-xs file:font-semibold file:text-white"
        />
        {uploading && (
          <span className="text-sm text-[var(--cl-ink-2)]">
            {t('assetUploader.uploading')}
          </span>
        )}
      </div>
      {uploaded !== null && (
        <p
          role="status"
          className="font-data m-0 text-xs text-[var(--tucu-state-green-ink)]"
        >
          {t('assetUploader.stored', { path: uploaded })}
        </p>
      )}
      {error !== null && <ErrorNotice surface="glass" error={error} />}
    </div>
  );
}
