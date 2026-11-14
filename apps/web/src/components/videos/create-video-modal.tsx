import { Modal } from '@e-burgos/tucu-ui';

import { useT } from '../../i18n/language-context';
import { CreateProjectForm } from '../create-project-form';

export type CreateVideoModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  existingSlugs: readonly string[];
  onCreated: () => void;
};

export function CreateVideoModal({ isOpen, setIsOpen, existingSlugs, onCreated }: CreateVideoModalProps) {
  const t = useT();

  return (
    <Modal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      size="lg"
      hideButtons
      text={{ title: t('projects.createVideoTitle') }}
      closeLabel={t('modal.close')}
      data-testid="create-video-modal"
    >
      <div className="pt-2">
        <CreateProjectForm existingSlugs={existingSlugs} onCreated={onCreated} onCancel={() => setIsOpen(false)} />
      </div>
    </Modal>
  );
}
