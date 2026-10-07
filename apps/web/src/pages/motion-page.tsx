import { useParams } from 'react-router-dom';

import { humanizeSlug } from '../api/humanize-slug';
import { useT } from '../i18n/language-context';

export function MotionPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const t = useT();

  return (
    <section className="space-y-2">
      <h1 className="text-lg font-semibold text-ink">{t('motion.page.title')}</h1>
      <p className="text-sm text-ink-faint">{humanizeSlug(slug)}</p>
    </section>
  );
}
