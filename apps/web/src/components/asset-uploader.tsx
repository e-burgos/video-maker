import { useId, useRef, useState } from 'react';

import { ASSET_ROLES } from '../api/render-api-types';
import { assetContentType } from '../api/asset-media-kind';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
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

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`${fieldId}-role`} className="text-sm text-slate-400">
          Upload to
        </label>
        {offered.length === 1 ? (
          <span id={`${fieldId}-role`} className="font-mono text-sm text-slate-100">
            {role}
          </span>
        ) : (
          <select
            id={`${fieldId}-role`}
            aria-label="Upload to"
            value={role}
            onChange={(event) => setRole(event.target.value as AssetRole)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm text-slate-100"
          >
            {offered.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        )}
        <input
          ref={inputRef}
          id={`${fieldId}-file`}
          type="file"
          aria-label={fileInputLabel ?? 'Asset file'}
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) {
              void upload(file);
            }
          }}
          className="text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:text-slate-200"
        />
        {uploading && <span className="text-sm text-slate-400">Uploading…</span>}
      </div>
      {uploaded !== null && (
        <p role="status" className="font-mono text-xs text-emerald-300">
          stored {uploaded}
        </p>
      )}
      {error !== null && <ErrorNotice error={error} />}
    </div>
  );
}
