import { buildProducerPrompt } from '@video-maker/producer-tools';
import type { ProducerPromptContext } from '@video-maker/producer-tools';

import type { ProducerProjectContext } from './collect-producer-context';

export const PRODUCER_BASE_ALLOWED_TOOLS = [
  'Bash(pnpm nx run render-cli:*)',
  'Bash(ffmpeg *)',
  'Bash(ffprobe *)',
  'Bash(curl *)',
  'Bash(ls *)',
  'Bash(cat *)',
  'Bash(rtk curl *)',
  'Bash(rtk ls *)',
  'Bash(rtk read *)',
  'Read',
  'Glob',
  'Grep',
  'Write',
  'Edit',
] as const;

export function producerAllowedTools(piperPath: string | null): readonly string[] {
  return piperPath === null
    ? [...PRODUCER_BASE_ALLOWED_TOOLS]
    : [...PRODUCER_BASE_ALLOWED_TOOLS, `Bash(${piperPath} *)`];
}

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
