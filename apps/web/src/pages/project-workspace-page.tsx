import { hasMaterialWarnings } from '@video-maker/timeline-core';
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';

import { projectModeOf } from '../api/project-mode';
import { recommendedConceptToApprove } from '../api/proposal-approval';
import { useRenderApi } from '../api/render-api-context';
import { primaryAssetRole } from '../api/workspace-panel';
import { useAsyncResource } from '../hooks/use-async-resource';
import { ErrorNotice } from '../components/error-notice';
import { ProducerConversationPanel } from '../components/producer-conversation-panel';
import { ProposalStatusBadge } from '../components/proposal-status-badge';
import { ToolbarStatus } from '../components/shell/toolbar-status';
import { useToolbarAction } from '../components/shell/use-toolbar-action';
import { SECONDARY_BUTTON_CLASS } from '../components/ui/cl-controls';
import { WorkspaceSidePanel } from '../components/workspace-side-panel';
import { useApiAction } from '../hooks/use-api-action';
import { useAutoSwitchingTab } from '../hooks/use-auto-switching-tab';
import { useIsWideViewport } from '../hooks/use-is-wide-viewport';
import { useProducerConversation } from '../hooks/use-producer-conversation';
import { useT } from '../i18n/language-context';

export function ProjectWorkspacePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const t = useT();
  const client = useRenderApi();
  const project = useAsyncResource(
    useCallback(async () => client.getProject(slug), [client, slug]),
    `workspace-project:${slug}`,
  );
  const producer = useProducerConversation(slug);
  const isWide = useIsWideViewport();
  const [activeTab, setActiveTab] = useAutoSwitchingTab(producer.jobs.data);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMotion = project.data !== null && projectModeOf(project.data) === 'motion';

  const proposal = producer.proposal.data?.proposal ?? null;
  const conceptToApprove = recommendedConceptToApprove(proposal);
  const approval = useApiAction((conceptId: string) => client.approveProposal(slug, conceptId));
  const reloadProposal = producer.proposal.reload;

  const approveRecommended = useCallback(async () => {
    if (conceptToApprove === null) {
      return;
    }
    if ((await approval.run(conceptToApprove)) !== null) {
      reloadProposal();
    }
  }, [approval, conceptToApprove, reloadProposal]);

  useToolbarAction(
    conceptToApprove === null
      ? null
      : {
          label: t('proposal.approveRecommended'),
          loading: approval.status === 'pending',
          onClick: () => void approveRecommended(),
        },
  );

  const warnings = proposal?.materialWarnings ?? producer.materialReview.data?.warnings ?? null;

  const sidePanel = (
    <WorkspaceSidePanel
      slug={slug}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      assets={producer.assets}
      jobs={producer.jobs}
      generated={producer.generated.data}
      primaryRole={primaryAssetRole(isMotion)}
      reviewPending={warnings !== null && hasMaterialWarnings(warnings)}
    />
  );

  return (
    <section
      data-testid="project-workspace"
      className={isWide ? 'flex h-full min-h-0 flex-col gap-3' : 'flex flex-col gap-3'}
    >
      <ToolbarStatus>
        <ProposalStatusBadge proposal={proposal} />
      </ToolbarStatus>

      {approval.error !== null && <ErrorNotice error={approval.error} />}

      {isMotion ? (
        <div className={isWide ? 'min-h-0 flex-1' : ''}>
          <ProducerConversationPanel producer={producer} pinned={isWide} mode="motion" />
        </div>
      ) : isWide ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2.2fr)] gap-3">
          <ProducerConversationPanel producer={producer} pinned />
          <div className="h-full min-h-0">{sidePanel}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ProducerConversationPanel producer={producer} />
          <button
            type="button"
            aria-expanded={drawerOpen}
            data-testid="workspace-panel-toggle"
            onClick={() => setDrawerOpen((open) => !open)}
            className={`${SECONDARY_BUTTON_CLASS} self-start`}
          >
            {drawerOpen ? t('workspace.panel.hide') : t('workspace.panel.show')}
          </button>
          {drawerOpen && sidePanel}
        </div>
      )}
    </section>
  );
}
