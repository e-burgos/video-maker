import { buildProducerPrompt } from '@video-maker/producer-tools';
import type { ProducerPromptContext } from '@video-maker/producer-tools';

import type { ProducerProjectContext } from './collect-producer-context';

function toPromptContext(context: ProducerProjectContext): ProducerPromptContext {
  return {
    assetSource: context.assetSource,
    assets: context.assets,
    hasTimeline: context.hasTimeline,
    producerScript: context.producerScript,
  };
}

export function buildProducerSystemPrompt(context: ProducerProjectContext): string {
  return buildProducerPrompt(toPromptContext(context));
}
