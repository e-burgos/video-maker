import type { ReactNode } from 'react';

export type TabItem<Id extends string> = {
  id: Id;
  label: string;
  badge?: string | null;
};

export type TabsProps<Id extends string> = {
  tabs: readonly TabItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  idPrefix: string;
};

export function Tabs<Id extends string>({ tabs, value, onChange, idPrefix }: TabsProps<Id>) {
  return (
    <div role="tablist" className="flex gap-1 rounded-control border border-border-subtle bg-surface p-1">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            data-testid={`${idPrefix}-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-control px-2 py-1.5 text-xs font-medium transition-colors ${
              selected ? 'bg-surface-muted text-ink' : 'text-ink-faint hover:text-ink-muted'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge !== null && (
              <span className="ml-1.5 rounded-full border border-border-strong px-1.5 py-0 text-[10px] text-ink-muted">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type TabPanelProps<Id extends string> = {
  id: Id;
  value: Id;
  idPrefix: string;
  children: ReactNode;
};

export function TabPanel<Id extends string>({ id, value, idPrefix, children }: TabPanelProps<Id>) {
  if (id !== value) {
    return null;
  }

  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`}>
      {children}
    </div>
  );
}
