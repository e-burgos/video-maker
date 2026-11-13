import { LANGUAGES, languageNameKey } from '../i18n/language';
import { useLanguage, useT } from '../i18n/language-context';

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  const t = useT();

  return (
    <div
      role="group"
      data-testid="language-switch"
      aria-label={t('language.switchLabel')}
      className="grid w-full grid-cols-2 gap-1 rounded-full border max-[1099px]:w-auto max-[1099px]:grid-cols-1 border-[var(--tucu-glass-sub-line)] bg-[var(--tucu-glass-sub-bg)] p-0.5"
    >
      {LANGUAGES.map((candidate) => (
        <button
          key={candidate}
          type="button"
          data-language={candidate}
          aria-pressed={candidate === language}
          aria-label={t(languageNameKey(candidate))}
          title={t(languageNameKey(candidate))}
          onClick={() => setLanguage(candidate)}
          className={`focus-cl min-h-8 rounded-full px-2 py-1 font-mono text-xs uppercase ${
            candidate === language
              ? 'bg-[var(--cl-ink)] text-[var(--cl-canvas)]'
              : 'text-[var(--cl-ink-3)] hover:text-[var(--cl-ink)]'
          }`}
        >
          {candidate}
        </button>
      ))}
    </div>
  );
}
