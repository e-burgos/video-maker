import { useCallback, useRef } from 'react';

export function useUploaderFocus() {
  const container = useRef<HTMLDivElement>(null);

  const focusUploader = useCallback(() => {
    const node = container.current;
    if (node === null) {
      return;
    }
    node.scrollIntoView?.({ block: 'center' });
    node.querySelector<HTMLInputElement>('input[type="file"]')?.focus();
  }, []);

  return { container, focusUploader };
}
