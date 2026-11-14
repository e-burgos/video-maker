import type { BrandEditor } from '../../hooks/use-brand-editor';
import type { SectionDraft } from '../../hooks/use-section-draft';
import { useT } from '../../i18n/language-context';
import { BRAND_INPUT_CLASS } from './brand-controls';
import type { IdentityDraft } from './brand-draft';
import { BrandField } from './brand-field';

export type BrandIdentitySectionProps = { editor: BrandEditor; draft: SectionDraft<IdentityDraft> };

export function BrandIdentitySection({ editor, draft: { draft, setDraft } }: BrandIdentitySectionProps) {
  const t = useT();

  function field(key: keyof IdentityDraft) {
    return {
      value: draft[key],
      disabled: editor.readOnly,
      className: BRAND_INPUT_CLASS,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setDraft((current) => ({ ...current, [key]: event.target.value })),
    };
  }

  return (
    <div data-testid="brand-section-identity" className="flex flex-col gap-4">
      <BrandField label={t('brands.identity.name')}>
        <input {...field('name')} />
      </BrandField>
      <BrandField label={t('brands.identity.spokenName')} hint={t('brands.identity.spokenNameHint')}>
        <input {...field('spokenName')} />
      </BrandField>
      <BrandField label={t('brands.identity.tagline')}>
        <input {...field('tagline')} />
      </BrandField>
      <BrandField label={t('brands.identity.url')}>
        <input {...field('url')} />
      </BrandField>
    </div>
  );
}
