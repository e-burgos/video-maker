import { buildProducerPrompt } from '@video-maker/producer-tools';
import type { ProducerPromptContext } from '@video-maker/producer-tools';

import type { ProducerProjectContext } from './collect-producer-context';

function toPromptContext(context: ProducerProjectContext): ProducerPromptContext {
  return {
    assetSource: context.assetSource,
    assets: context.assets,
    pendingAssets: context.pendingAssets,
    hasTimeline: context.hasTimeline,
    producerScript: context.producerScript,
    mode: context.mode,
    brand: context.brand,
  };
}

export function buildProducerSystemPrompt(context: ProducerProjectContext): string {
  return buildProducerPrompt(toPromptContext(context));
}
