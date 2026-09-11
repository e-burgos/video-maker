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
      className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 p-0.5"
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
          className={`rounded-full px-2 py-1 font-mono text-xs uppercase ${
            candidate === language
              ? 'bg-slate-200 text-slate-900'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {candidate}
        </button>
      ))}
    </div>
  );
}
