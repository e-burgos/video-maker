import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/app';
import { ThemeProvider } from './theme/theme-context';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root container in index.html');
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
