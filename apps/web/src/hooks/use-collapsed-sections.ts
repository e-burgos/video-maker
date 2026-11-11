import { useCallback, useState } from 'react';

export const COLLAPSED_SECTIONS_STORAGE_KEY = 'video-maker.collapsed-sections';

export function folderSectionKey(folderId: string): string {
  return `folder:${folderId}`;
}

export function categorySectionKey(folderId: string, categoryId: string): string {
  return `category:${folderId}:${categoryId}`;
}

function readCollapsedSections(): ReadonlySet<string> {
  try {
    const stored = window.localStorage.getItem(COLLAPSED_SECTIONS_STORAGE_KEY);
    const parsed: unknown = stored === null ? [] : JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : []);
  } catch {
    return new Set();
  }
}

function storeCollapsedSections(keys: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(COLLAPSED_SECTIONS_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    return;
  }
}

export function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(readCollapsedSections);

  const isCollapsed = useCallback((key: string) => collapsed.has(key), [collapsed]);

  const toggle = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      storeCollapsedSections(next);
      return next;
    });
  }, []);

  return { isCollapsed, toggle };
}
