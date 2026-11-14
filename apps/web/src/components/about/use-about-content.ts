import { useEffect, useState } from 'react';

import { loadAboutContent } from '../../content/about/about-content';
import type { AboutContent } from '../../content/about/about-content';
import { useLanguage } from '../../i18n/language-context';

export function useAboutContent(): AboutContent | null {
  const { language } = useLanguage();
  const [content, setContent] = useState<AboutContent | null>(null);

  useEffect(() => {
    let subscribed = true;
    void loadAboutContent(language).then((loaded) => {
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
