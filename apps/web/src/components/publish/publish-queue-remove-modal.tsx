import type { PublishQueueItem } from '../../api/publish-queue-types';
import { useT } from '../../i18n/language-context';
import { Modal } from '../modal';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '../ui/cl-controls';

export type PublishQueueRemoveModalProps = {
  item: PublishQueueItem;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PublishQueueRemoveModal({ item, pending, onCancel, onConfirm }: PublishQueueRemoveModalProps) {
  const t = useT();

  return (
    <Modal
      title={t('publishQueue.removeTitle')}
      testId="publish-queue-remove-modal"
      onClose={onCancel}
      footer={
        <>
          <button type="button" disabled={pending} onClick={onCancel} className={SECONDARY_BUTTON_CLASS}>
            {t('publishQueue.cancel')}
          </button>
          <button
            type="button"
            data-testid="publish-queue-remove-accept"
            disabled={pending}
            onClick={onConfirm}
            className={PRIMARY_BUTTON_CLASS}
          >
            {t('publishQueue.removeConfirm')}
          </button>
        </>
      }
    >
      <p>{t('publishQueue.removeBody', { title: item.metadata.title })}</p>
    </Modal>
  );
}
