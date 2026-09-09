import type { EditDecisionList } from '@video-maker/timeline-core';
import { defaultFormat } from '@video-maker/timeline-core';

export function buildMinimalEditDecisionList(): EditDecisionList {
  return {
    schemaVersion: 1,
    sourceAssetId: 'minimal-aroll',
    format: defaultFormat('reels-9x16'),
    generatedBy: { tool: 'render-api-fixture', params: {} },
    decisions: [{ id: 'keep-0001', type: 'keep', startMs: 0, endMs: 5_400 }],
  };
}
