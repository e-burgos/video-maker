import { useState } from 'react';

import { RenderApiError, serviceUnreachable } from '../../api/render-api-error';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { Modal } from '../modal';
import { PRIMARY_BUTTON_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import { BRAND_INPUT_CLASS } from './brand-controls';
import { BrandField } from './brand-field';

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
      surface="glass"
      testId={testId}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            data-testid={`${testId}-cancel`}
            disabled={pending}
            onClick={onClose}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t('brands.cancel')}
          </button>
          <button
            type="button"
            data-testid={`${testId}-submit`}
            disabled={pending || name.trim() === ''}
            onClick={() => void submit()}
            className={PRIMARY_BUTTON_SMALL_CLASS}
          >
            {submitLabel}
          </button>
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
      {error !== null && <ErrorNotice error={error} surface="glass" />}
    </Modal>
  );
}
