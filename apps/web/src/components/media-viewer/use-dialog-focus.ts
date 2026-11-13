import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

export function useDialogFocus(
  container: RefObject<HTMLElement | null>,
  trigger: HTMLElement | null,
): void {
  useEffect(() => {
    const node = container.current;
    const returnTo =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    node?.focus();

    function keepFocusInside(event: KeyboardEvent): void {
      if (event.key !== 'Tab' || node === null) {
        return;
      }
      const focusable = focusableWithin(node);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        node.focus();
        return;
      }
      const active = document.activeElement;
      const outside =
        active === null || !node.contains(active) || active === node;
      if (event.shiftKey && (outside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (outside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', keepFocusInside);
    return () => {
      document.removeEventListener('keydown', keepFocusInside);
      if (returnTo !== null && returnTo.isConnected) {
        returnTo.focus();
      }
    };
  }, [container, trigger]);
}
