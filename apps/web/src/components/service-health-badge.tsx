import { useState } from 'react';

import { ServiceHealthModal } from './shell/service-health-modal';
import { ServiceHealthTrigger } from './shell/service-health-trigger';
import { useServiceHealth } from './shell/use-service-health';

export function ServiceHealthBadge() {
  const { state, label, detail, reload } = useServiceHealth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ServiceHealthTrigger state={state} label={label} onOpen={() => setIsOpen(true)} />
      <ServiceHealthModal isOpen={isOpen} setIsOpen={setIsOpen} detail={detail} reload={reload} />
    </>
  );
}
