import { useEffect, useState } from 'react';

import { loadAgentsContent } from '../../content/agents/agents-content';
import type { AgentsContent } from '../../content/agents/agents-content';
import { useLanguage } from '../../i18n/language-context';

export function useAgentsContent(): AgentsContent | null {
  const { language } = useLanguage();
  const [content, setContent] = useState<AgentsContent | null>(null);

  useEffect(() => {
    let subscribed = true;
    void loadAgentsContent(language).then((loaded) => {
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
