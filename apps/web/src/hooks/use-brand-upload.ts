import { useCallback, useState } from 'react';

import { brandContentType, safeUploadName } from '../api/brand-files';
import type { BrandFileKind } from '../api/brand-types';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';

export type BrandUpload = {
  uploading: boolean;
  error: RenderApiError | null;
  upload: (kind: BrandFileKind, file: File) => Promise<string | null>;
};

export function useBrandUpload(brandId: string): BrandUpload {
  const client = useRenderApi();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<RenderApiError | null>(null);

  const upload = useCallback(
    async (kind: BrandFileKind, file: File): Promise<string | null> => {
      setUploading(true);
      setError(null);
      try {
        const stored = await client.uploadBrandFile({
          id: brandId,
          kind,
          filename: safeUploadName(file.name),
          contentType: brandContentType(file.name, file.type),
          body: file,
        });
        return stored.path;
      } catch (cause) {
        setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
        return null;
      } finally {
        setUploading(false);
      }
    },
    [client, brandId],
  );

  return { uploading, error, upload };
}
