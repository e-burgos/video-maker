import { useCallback, useState } from 'react';

import { assetContentType, assetMediaKind } from '../api/asset-media-kind';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { useAsyncResource } from './use-async-resource';
import type { AsyncResource } from './use-async-resource';
import type { AssetRole, InboxListing } from '../api/render-api-types';

export type InboxUploadStatus = 'uploading' | 'done' | 'error';

export type InboxUploadEntry = {
  id: string;
  fileName: string;
  status: InboxUploadStatus;
  errorCode: string | null;
};

export type UseInboxUploadsResult = {
  pending: AsyncResource<InboxListing>;
  uploads: readonly InboxUploadEntry[];
  uploadFiles: (files: Iterable<File>) => Promise<void>;
  confirm: (assetId: string, role: AssetRole) => Promise<void>;
  discard: (assetId: string) => Promise<void>;
  dismissUpload: (id: string) => void;
};

let uploadSequence = 0;

function toRenderApiError(cause: unknown): RenderApiError {
  return cause instanceof RenderApiError ? cause : serviceUnreachable(cause);
}

export function useInboxUploads(slug: string): UseInboxUploadsResult {
  const client = useRenderApi();
  const pending = useAsyncResource<InboxListing>(() => client.listInbox(slug), `inbox:${slug}`);
  const [uploads, setUploads] = useState<InboxUploadEntry[]>([]);

  const uploadOne = useCallback(
    async (file: File) => {
      uploadSequence += 1;
      const id = `upload-${uploadSequence}`;
      setUploads((current) => [...current, { id, fileName: file.name, status: 'uploading', errorCode: null }]);

      if (assetMediaKind(file.name) === 'other') {
        setUploads((current) =>
          current.map((entry) =>
            entry.id === id ? { ...entry, status: 'error', errorCode: 'UNSUPPORTED_MEDIA_TYPE' } : entry,
          ),
        );
        return;
      }

      try {
        await client.uploadToInbox({
          slug,
          filename: file.name,
          contentType: file.type === '' ? assetContentType(file.name) : file.type,
          body: file,
        });
        setUploads((current) => current.map((entry) => (entry.id === id ? { ...entry, status: 'done' } : entry)));
        pending.reload();
      } catch (cause) {
        const typed = toRenderApiError(cause);
        setUploads((current) =>
          current.map((entry) => (entry.id === id ? { ...entry, status: 'error', errorCode: typed.code } : entry)),
        );
      }
    },
    [client, slug, pending],
  );

  const uploadFiles = useCallback(
    async (files: Iterable<File>) => {
      await Promise.all([...files].map((file) => uploadOne(file)));
    },
    [uploadOne],
  );

  const confirm = useCallback(
    async (assetId: string, role: AssetRole) => {
      await client.confirmInboxAsset(slug, assetId, role);
      pending.reload();
    },
    [client, slug, pending],
  );

  const discard = useCallback(
    async (assetId: string) => {
      await client.discardInboxAsset(slug, assetId);
      pending.reload();
    },
    [client, slug, pending],
  );

  const dismissUpload = useCallback((id: string) => {
    setUploads((current) => current.filter((entry) => entry.id !== id));
  }, []);

  return { pending, uploads, uploadFiles, confirm, discard, dismissUpload };
}
