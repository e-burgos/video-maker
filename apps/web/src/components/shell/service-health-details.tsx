import { useT } from '../../i18n/language-context';
import type { ServiceHealth } from '../../api/render-api-types';
import { capabilityRows } from './capability-rows';

const OK_ROW = 'text-[var(--tucu-state-green-ink)]';
const MISSING_ROW = 'text-[var(--tucu-state-red-ink)]';
const OFF_ROW = 'text-[var(--tucu-state-orange-ink)]';

type SectionProps = {
  title: string;
  listTestId?: string;
  children: React.ReactNode;
};

function HealthSection({ title, listTestId, children }: SectionProps) {
  return (
    <section className="space-y-1.5">
      <h3 className="font-mono text-xs uppercase tracking-wide text-[var(--cl-ink-3)]">{title}</h3>
      <ul data-testid={listTestId} className="space-y-1 font-mono text-xs">
        {children}
      </ul>
    </section>
  );
}

export function ServiceHealthDetails({ detail }: { detail: ServiceHealth | null }) {
  const t = useT();

  if (detail === null) {
    return <p className="text-[var(--cl-ink-2)]">{t('health.empty')}</p>;
  }

  return (
    <div className="space-y-4">
      <HealthSection title={t('health.enginesTitle')}>
        {detail.engine.map((module) => (
          <li key={module.name} className={module.loaded ? OK_ROW : MISSING_ROW}>
            {module.name} · {module.loaded ? t('health.loaded') : t('health.notLoaded')}
          </li>
        ))}
      </HealthSection>

      <HealthSection title={t('health.binaries')} listTestId="service-health-binaries">
        {detail.binaries.map((binary) => (
          <li key={binary.name} className={binary.resolved ? OK_ROW : MISSING_ROW}>
            {binary.name} · {binary.envVar} ·{' '}
            {binary.resolved ? t('health.resolved') : t('health.missing')}
          </li>
        ))}
      </HealthSection>

      <HealthSection title={t('health.capabilities')} listTestId="service-health-capabilities">
        {capabilityRows(detail.capabilities).map(({ name, enabled }) => (
          <li key={name} className={enabled ? OK_ROW : OFF_ROW}>
            {name} · {enabled ? t('health.on') : t('health.off')}
          </li>
        ))}
      </HealthSection>

      <HealthSection title={t('health.jobsTitle')}>
        <li className="text-[var(--cl-ink-2)]">
          {t('health.jobs', { running: detail.jobs.running, queued: detail.jobs.queued })}
        </li>
      </HealthSection>
    </div>
  );
}
