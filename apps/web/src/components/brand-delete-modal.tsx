import { useState } from 'react';

import type { BrandSummary } from '../api/brand-types';
import { useRenderApi } from '../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Modal } from './modal';
import { Button } from './ui/button';

export type BrandDeleteModalProps = {
  brand: BrandSummary;
  onClose: () => void;
  onDeleted: () => void;
};

export function BrandDeleteModal({ brand, onClose, onDeleted }: BrandDeleteModalProps) {
  const client = useRenderApi();
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<RenderApiError | null>(null);

  async function confirm(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await client.deleteBrand(brand.id);
      onDeleted();
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
      setPending(false);
    }
  }

  return (
    <Modal
      testId="brand-delete-modal"
      title={t('brands.delete.title', { name: brand.name })}
      onClose={onClose}
      footer={
        <>
          <Button data-testid="brand-delete-cancel" disabled={pending} onClick={onClose}>
            {t('brands.cancel')}
          </Button>
          <Button
            variant="primary"
            data-testid="brand-delete-confirm"
            disabled={pending}
            onClick={() => void confirm()}
          >
            {t('brands.delete.confirm')}
          </Button>
        </>
      }
    >
      <p>{t('brands.delete.explanation')}</p>
      {error !== null && <ErrorNotice error={error} />}
    </Modal>
  );
}
