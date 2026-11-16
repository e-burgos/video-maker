import { useEffect } from 'react';

export const VISIBLE_RELOAD_INTERVAL_MS = 20_000;

export function useReloadWhenVisible(reload: () => void, intervalMs: number = VISIBLE_RELOAD_INTERVAL_MS): void {
  useEffect(() => {
    const reloadIfVisible = (): void => {
      if (document.visibilityState === 'visible') {
        reload();
      }
    };
    window.addEventListener('focus', reloadIfVisible);
    document.addEventListener('visibilitychange', reloadIfVisible);
    const timer = window.setInterval(reloadIfVisible, intervalMs);
    return () => {
      window.removeEventListener('focus', reloadIfVisible);
      document.removeEventListener('visibilitychange', reloadIfVisible);
      window.clearInterval(timer);
    };
  }, [reload, intervalMs]);
}
