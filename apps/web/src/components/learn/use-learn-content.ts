import { useEffect, useState } from 'react';

import { loadLearnContent } from '../../content/learn/learn-content';
import type { LearnContent } from '../../content/learn/learn-content';
import { useLanguage } from '../../i18n/language-context';

export function useLearnContent(): LearnContent | null {
  const { language } = useLanguage();
  const [content, setContent] = useState<LearnContent | null>(null);

  useEffect(() => {
    let subscribed = true;
    void loadLearnContent(language).then((loaded) => {
      if (subscribed) {
        setContent(loaded);
      }
    });
    return () => {
      subscribed = false;
    };
  }, [language]);

  return content;
}
