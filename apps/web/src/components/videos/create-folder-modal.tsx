import { Modal } from '@e-burgos/tucu-ui';

import { useT } from '../../i18n/language-context';
import { CreateFolderForm } from '../create-folder-form';

export type CreateFolderModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onCreated: () => void;
};

export function CreateFolderModal({ isOpen, setIsOpen, onCreated }: CreateFolderModalProps) {
  const t = useT();

  return (
    <Modal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      size="md"
      hideButtons
      text={{ title: t('createFolder.label') }}
      closeLabel={t('modal.close')}
      data-testid="create-folder-modal"
    >
      <div className="pt-2">
        <CreateFolderForm
          onCreated={() => {
            setIsOpen(false);
            onCreated();
          }}
        />
      </div>
    </Modal>
  );
}
