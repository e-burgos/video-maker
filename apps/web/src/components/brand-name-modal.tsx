import { useState } from 'react';

import { RenderApiError, serviceUnreachable } from '../api/render-api-error';
import { useT } from '../i18n/language-context';
import { BRAND_INPUT_CLASS, BrandField } from './brand-field';
import { ErrorNotice } from './error-notice';
import { Modal } from './modal';
import { Button } from './ui/button';

export type BrandNameModalProps = {
  title: string;
  description?: string;
  initialName: string;
  submitLabel: string;
  testId: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
};

export function BrandNameModal({
  title,
  description,
  initialName,
  submitLabel,
  testId,
  onSubmit,
  onClose,
}: BrandNameModalProps) {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<RenderApiError | null>(null);

  async function submit(): Promise<void> {
    if (name.trim() === '') {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit(name.trim());
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
      setPending(false);
    }
  }

  return (
    <Modal
      testId={testId}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button data-testid={`${testId}-cancel`} disabled={pending} onClick={onClose}>
            {t('brands.cancel')}
          </Button>
          <Button
            variant="primary"
            data-testid={`${testId}-submit`}
            disabled={pending || name.trim() === ''}
            onClick={() => void submit()}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      {description !== undefined && <p>{description}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <BrandField label={t('brands.name.label')}>
          <input
            data-testid={`${testId}-name`}
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            className={BRAND_INPUT_CLASS}
          />
        </BrandField>
      </form>
      {error !== null && <ErrorNotice error={error} />}
    </Modal>
  );
}
