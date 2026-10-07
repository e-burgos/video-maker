import type { BrandManifest } from '../brand/brand-manifest';
import { MotionStudioError } from '../errors/motion-studio-error';
import { MotionStoryboardSchema } from '../storyboard/motion-storyboard.schema';
import type { MotionStoryboard } from '../storyboard/motion-storyboard.schema';
import { formatIssuePath } from '../storyboard/parse-motion-storyboard';
import { buildAutoStoryboardRequest } from './build-auto-storyboard-request';
import type { AutoStoryboardRequest } from './build-auto-storyboard-request';
import { checkStoryboardAgainstBrief, enforceBrief } from './check-storyboard-against-brief';
import type { StoryboardIssue } from './check-storyboard-against-brief';
import type { MotionBrief } from './motion-brief';

export interface AskUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd?: number | null;
}

export interface AskResponse {
  json: unknown;
  usage: AskUsage;
}

export type AskStoryboardAgent = (request: AutoStoryboardRequest) => Promise<AskResponse>;

export interface GeneratedStoryboard {
  storyboard: MotionStoryboard;
  usage: { inputTokens: number; outputTokens: number; costUsd: number | null };
  repaired: boolean;
}

const MAX_REPORTED_ISSUES = 20;

type Validation = { ok: true; storyboard: MotionStoryboard } | { ok: false; issues: StoryboardIssue[] };

function anchorBrandRevealOnDrop(storyboard: MotionStoryboard, brand: BrandManifest): MotionStoryboard {
  const track = storyboard.music === null ? undefined : brand.music.find((candidate) => candidate.id === storyboard.music?.track);
  if (track?.drop === undefined) return storyboard;
  return { ...storyboard, scenes: storyboard.scenes.map((scene) => (scene.kind === 'brand-reveal' && scene.anchor === undefined ? { ...scene, anchor: 'drop' } : scene)) };
}

function normalizeWords(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function repeatsBrandTagline(tagline: string | undefined, brand: BrandManifest): boolean {
  return tagline !== undefined && normalizeWords(tagline).startsWith(normalizeWords(brand.tagline));
}

function useBrandTaglineWhenCopied(storyboard: MotionStoryboard, brand: BrandManifest): MotionStoryboard {
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((scene) => {
      if ((scene.kind !== 'brand-reveal' && scene.kind !== 'cta') || !repeatsBrandTagline(scene.props.tagline, brand)) return scene;
      const brandTaglineProps = Object.fromEntries(Object.entries(scene.props).filter(([key]) => key !== 'tagline' && key !== 'accent'));
      return { ...scene, props: brandTaglineProps } as typeof scene;
    }),
  };
}

function validate(raw: unknown, brief: MotionBrief, brand: BrandManifest): Validation {
  const parsed = MotionStoryboardSchema.safeParse(enforceBrief(raw, brief));
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((issue) => ({ path: formatIssuePath(issue.path) || 'storyboard', message: issue.message })) };
  const issues = checkStoryboardAgainstBrief(parsed.data, brief, brand);
  return issues.length === 0 ? { ok: true, storyboard: useBrandTaglineWhenCopied(anchorBrandRevealOnDrop(parsed.data, brand), brand) } : { ok: false, issues };
}

function formatIssues(issues: StoryboardIssue[]): string {
  return issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => `- ${issue.path}: ${issue.message}`).join('\n');
}

function repairRequest(request: AutoStoryboardRequest, previous: unknown, issues: StoryboardIssue[]): AutoStoryboardRequest {
  return {
    ...request,
    userPrompt: [
      request.userPrompt,
      'YOUR PREVIOUS ANSWER',
      JSON.stringify(previous),
      'It was rejected for these errors. Return the full corrected JSON object and nothing else:',
      formatIssues(issues),
    ].join('\n\n'),
  };
}

async function askOrFail(ask: AskStoryboardAgent, request: AutoStoryboardRequest): Promise<AskResponse> {
  try {
    return await ask(request);
  } catch (cause) {
    throw new MotionStudioError('AI_FAILED', `the agent failed: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}

export async function generateMotionStoryboard(ask: AskStoryboardAgent, brief: MotionBrief, brand: BrandManifest): Promise<GeneratedStoryboard> {
  const request = buildAutoStoryboardRequest(brief, brand);
  const first = await askOrFail(ask, request);
  const firstValidation = validate(first.json, brief, brand);
  if (firstValidation.ok) return { storyboard: firstValidation.storyboard, usage: sumUsage([first.usage]), repaired: false };

  const second = await askOrFail(ask, repairRequest(request, first.json, firstValidation.issues));
  const secondValidation = validate(second.json, brief, brand);
  if (secondValidation.ok) return { storyboard: secondValidation.storyboard, usage: sumUsage([first.usage, second.usage]), repaired: true };
  throw new MotionStudioError('STORYBOARD_INVALID', `the generated storyboard is invalid after one repair:\n${formatIssues(secondValidation.issues)}`);
}

function sumUsage(usages: AskUsage[]): GeneratedStoryboard['usage'] {
  const costs = usages.map((usage) => usage.costUsd ?? null);
  return {
    inputTokens: usages.reduce((sum, usage) => sum + usage.inputTokens, 0),
    outputTokens: usages.reduce((sum, usage) => sum + usage.outputTokens, 0),
    costUsd: costs.some((cost) => cost === null) ? null : costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0),
  };
}
