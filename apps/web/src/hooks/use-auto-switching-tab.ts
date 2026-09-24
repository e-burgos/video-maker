import { useEffect, useRef, useState } from 'react';

import { tabForNewlySucceededJob } from '../api/workspace-panel';
import type { WorkspaceTabId } from '../api/workspace-panel';
import type { RenderJobListing } from '../api/render-api-types';

export function useAutoSwitchingTab(
  jobs: RenderJobListing | null,
): [WorkspaceTabId, (tab: WorkspaceTabId) => void] {
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('preview');
  const previousJobsRef = useRef<RenderJobListing | null>(null);
  const hasBaselineRef = useRef(false);

  useEffect(() => {
    if (jobs === null) {
      return;
    }

    if (!hasBaselineRef.current) {
      hasBaselineRef.current = true;
      previousJobsRef.current = jobs;
      return;
    }

    const nextTab = tabForNewlySucceededJob(previousJobsRef.current, jobs);
    previousJobsRef.current = jobs;
    if (nextTab !== null) {
      setActiveTab(nextTab);
    }
  }, [jobs]);

  return [activeTab, setActiveTab];
}
