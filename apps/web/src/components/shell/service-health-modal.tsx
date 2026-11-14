import { Modal } from '@e-burgos/tucu-ui';
import { Link } from 'react-router-dom';

import { useT } from '../../i18n/language-context';
import { REQUIREMENTS_PATH } from '../about/about-tabs';
import { ServiceHealthDetails } from './service-health-details';
import type { ServiceHealth } from '../../api/render-api-types';

type ServiceHealthModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  detail: ServiceHealth | null;
  reload: () => void;
};

const FOOTER_BUTTON =
  'focus-cl rounded-full border border-[var(--tucu-glass-sub-line)] px-4 py-1.5 text-xs text-[var(--cl-ink-2)] hover:border-[var(--cl-ink-3)]';

export function ServiceHealthModal({ isOpen, setIsOpen, detail, reload }: ServiceHealthModalProps) {
  const t = useT();

  return (
    <Modal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      size="md"
      hideButtons
      text={{ title: t('health.title') }}
      closeLabel={t('modal.close')}
      data-testid="service-health-modal"
    >
      <div data-testid="service-health-details" className="space-y-4 pt-1 text-sm">
        <ServiceHealthDetails detail={detail} />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Link
          to={REQUIREMENTS_PATH}
          data-testid="service-health-requirements"
          onClick={() => setIsOpen(false)}
          className={`${FOOTER_BUTTON} mr-auto`}
        >
          {t('health.viewRequirements')}
        </Link>
        <button
          type="button"
          data-testid="service-health-recheck"
          title={t('health.recheck')}
          onClick={reload}
          className={FOOTER_BUTTON}
        >
          {t('health.recheckAction')}
        </button>
        <button
          type="button"
          data-testid="service-health-close"
          onClick={() => setIsOpen(false)}
          className={FOOTER_BUTTON}
        >
          {t('modal.close')}
        </button>
      </div>
    </Modal>
  );
}
