import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { preloadFallbackMessages } from './i18n/language-context';

await preloadFallbackMessages();

afterEach(() => {
  cleanup();
});
