import { generateMotionStoryboard } from '../auto/generate-motion-storyboard';
import type { AskUsage } from '../auto/generate-motion-storyboard';
import type { MotionBrief } from '../auto/motion-brief';
import { composeFromStoryboard } from './compose-from-storyboard';
import { joinPath } from './join-path';
import type { MotionPipelinePorts } from './ports';
import { readBrand, toJson } from './project-files';

export interface AutoStoryboardResult {
  lines: string[];
  repaired: boolean;
  usage: AskUsage;
}

export async function autoStoryboard(ports: MotionPipelinePorts, brief: MotionBrief, sourceDir: string, project: string): Promise<AutoStoryboardResult> {
  const brand = await readBrand(ports, brief.brand);
  const generated = await generateMotionStoryboard(ports.askAgent, brief, brand);
  await ports.writeText(joinPath(project, 'storyboard.json'), toJson(generated.storyboard, 2));
  const composeReport = await composeFromStoryboard(ports, generated.storyboard, sourceDir, project);
  const { inputTokens, outputTokens, costUsd } = generated.usage;
  return {
    lines: [
      `auto: ${generated.storyboard.scenes.length} scenes · repaired ${generated.repaired ? 'yes' : 'no'} · tokens in ${inputTokens} / out ${outputTokens}${costUsd === null ? '' : ` · $${costUsd.toFixed(4)}`}`,
      ...composeReport.lines,
    ],
    repaired: generated.repaired,
    usage: generated.usage,
  };
}
