import { withOptionalText } from '../api/brand-manifest-edit';
import { useSectionDraft } from '../hooks/use-section-draft';
import type { BrandEditor } from '../hooks/use-brand-editor';
import { useT } from '../i18n/language-context';
import { BRAND_INPUT_CLASS, BrandField } from './brand-field';
import { BrandSaveBar } from './brand-save-bar';

export function BrandIdentitySection({ editor }: { editor: BrandEditor }) {
  const t = useT();
  const manifest = editor.manifest;
  const saved = {
    name: manifest?.name ?? '',
    spokenName: manifest?.spokenName ?? '',
    tagline: manifest?.tagline ?? '',
    url: manifest?.url ?? '',
  };
  const { draft, setDraft, dirty } = useSectionDraft(saved);
  const invalid =
    draft.name.trim() === '' || draft.spokenName.trim() === '' || draft.tagline.trim() === ''
      ? t('brands.identity.required')
      : null;

  function field(key: keyof typeof draft) {
    return {
      value: draft[key],
      disabled: editor.readOnly,
      className: BRAND_INPUT_CLASS,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setDraft((current) => ({ ...current, [key]: event.target.value })),
    };
  }

  function save(): void {
    void editor.update((current) =>
      withOptionalText(
        {
          ...current,
          name: draft.name.trim(),
          spokenName: draft.spokenName.trim(),
          tagline: draft.tagline.trim(),
        },
        'url',
        draft.url,
      ),
    );
  }

  return (
    <div data-testid="brand-section-identity" className="space-y-4">
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
      <BrandSaveBar editor={editor} dirty={dirty} onSave={save} testId="brand-identity-save" invalidMessage={invalid} />
    </div>
  );
}
