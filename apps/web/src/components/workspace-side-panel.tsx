import { SegmentedControl, segmentedControlPanelId, segmentedControlTabId } from '@e-burgos/tucu-ui';

import type { WorkspaceTabId } from '../api/workspace-panel';
import type { AsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { WorkspaceDeliveriesTab } from './workspace/workspace-deliveries-tab';
import { WorkspaceMaterialTab } from './workspace/workspace-material-tab';
import { WorkspacePreview } from './workspace/workspace-preview';
import type { AssetListing, AssetRole, GeneratedListing, RenderJobListing } from '../api/render-api-types';

export type WorkspaceSidePanelProps = {
  slug: string;
  activeTab: WorkspaceTabId;
  onTabChange: (tab: WorkspaceTabId) => void;
  assets: AsyncResource<AssetListing>;
  jobs: AsyncResource<RenderJobListing>;
  generated?: GeneratedListing | null;
  primaryRole?: AssetRole;
  reviewPending?: boolean;
};

const TABS_ID_BASE = 'workspace';

export function WorkspaceSidePanel({
  slug,
  activeTab,
  onTabChange,
  assets,
  jobs,
  generated = null,
  primaryRole = 'aroll',
  reviewPending = false,
}: WorkspaceSidePanelProps) {
  const t = useT();
  const options = [
    { value: 'material', label: t('workspace.tab.material'), 'data-testid': 'workspace-tab-material' },
    { value: 'deliveries', label: t('workspace.tab.deliveries'), 'data-testid': 'workspace-tab-deliveries' },
  ];

  return (
    <div data-testid="workspace-side-panel" className="flex h-full min-h-0 flex-col gap-3">
      <WorkspacePreview slug={slug} jobs={jobs} generated={generated} />

      <section className="glass flex min-h-0 flex-1 flex-col gap-3 rounded-[20px] p-4">
        <div className="glass-thin self-start rounded-[10px] p-[3px]">
          <SegmentedControl
            semantics="tabs"
            idBase={TABS_ID_BASE}
            aria-label={t('workspace.tabs.label')}
            size="sm"
            options={options}
            value={activeTab}
            onChange={(next) => onTabChange(next as WorkspaceTabId)}
          />
        </div>

        <div
          role="tabpanel"
          id={segmentedControlPanelId(TABS_ID_BASE, activeTab)}
          aria-labelledby={segmentedControlTabId(TABS_ID_BASE, activeTab)}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {activeTab === 'material' ? (
            <WorkspaceMaterialTab slug={slug} assets={assets} primaryRole={primaryRole} reviewPending={reviewPending} />
          ) : (
            <WorkspaceDeliveriesTab slug={slug} jobs={jobs} generated={generated} />
          )}
        </div>
      </section>
    </div>
  );
}
