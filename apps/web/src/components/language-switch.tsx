import { Switch } from '@e-burgos/tucu-ui';

import { LANGUAGES, languageNameKey } from '../i18n/language';
import type { Language } from '../i18n/language';
import { useLanguage, useT } from '../i18n/language-context';
import { FOOTER_CONTROL_CLASS } from './shell/footer-control-style';

const [OFF_LANGUAGE, ON_LANGUAGE] = LANGUAGES;

function codeClass(active: boolean): string {
  const tone = active ? 'text-[var(--cl-ink)]' : 'text-[var(--cl-ink-3)] hover:text-[var(--cl-ink)]';
  return `focus-cl min-w-8 rounded-[6px] px-1 py-0.5 text-center font-mono text-xs font-semibold uppercase ${tone}`;
}

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  const t = useT();
  const otherLanguage: Language = language === ON_LANGUAGE ? OFF_LANGUAGE : ON_LANGUAGE;

  const codeButton = (candidate: Language) => (
    <button
      type="button"
      data-language={candidate}
      aria-pressed={candidate === language}
      aria-label={t(languageNameKey(candidate))}
      title={t(languageNameKey(candidate))}
      onClick={() => setLanguage(candidate)}
      className={codeClass(candidate === language)}
    >
      {candidate}
    </button>
  );

  return (
    <div
      role="group"
      data-testid="language-switch"
      data-current-language={language}
      aria-label={t('language.switchLabel')}
      className={`${FOOTER_CONTROL_CLASS} justify-between max-[1099px]:w-auto max-[1099px]:justify-center max-[1099px]:border-0 max-[1099px]:bg-transparent max-[1099px]:p-0 max-[1099px]:min-h-0`}
    >
      <div className="flex w-full items-center justify-between max-[1099px]:hidden">
        {codeButton(OFF_LANGUAGE)}
        <div className="relative h-5 w-9 shrink-0">
          <div className="absolute left-0 top-0 origin-top-left scale-[0.64]">
            <Switch
              checked={language === ON_LANGUAGE}
              onChange={(checked) => setLanguage(checked ? ON_LANGUAGE : OFF_LANGUAGE)}
              offLabel={null}
              onLabel={null}
              aria-label={t('language.switchLabel')}
            />
          </div>
        </div>
        {codeButton(ON_LANGUAGE)}
      </div>
      <button
        type="button"
        data-testid="language-switch-compact"
        title={t(languageNameKey(otherLanguage))}
        aria-label={t('language.switchLabel')}
        onClick={() => setLanguage(otherLanguage)}
        className="focus-cl hidden size-8 place-items-center rounded-[10px] border border-[var(--tucu-glass-sub-line)] bg-[var(--tucu-glass-sub-bg)] font-mono text-xs uppercase text-[var(--cl-ink)] max-[1099px]:grid"
      >
        {language}
      </button>
    </div>
  );
}
