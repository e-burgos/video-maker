import { z } from 'zod';

import { SceneVisualReviewSchema, reviewStatusFor } from './review-report';
import type { ReviewFinding, ReviewReport, SceneFrame, SceneVisualReview, VisualReview } from './review-report';

export const VISUAL_NOT_REVIEWED_CHECK = 'visual-not-reviewed';
export const VISUAL_REVIEW_CHECK = 'visual-review';

export const VisualReviewDraftSchema = z.strictObject({
  scenes: z.array(SceneVisualReviewSchema).min(1),
});

export type VisualReviewDraft = z.infer<typeof VisualReviewDraftSchema>;

export function isSceneFlagged(scene: SceneVisualReview): boolean {
  return scene.verdict === 'fix' || !scene.matchesVoice || !scene.legible || scene.couldBeOtherProduct;
}

export function visualReviewProblems(draft: VisualReviewDraft, frames: readonly SceneFrame[]): string[] {
  const expected = new Set(frames.map((frame) => frame.sceneId));
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const scene of draft.scenes) {
    if (!expected.has(scene.sceneId)) {
      problems.push(`unknown scene "${scene.sceneId}"`);
    } else if (seen.has(scene.sceneId)) {
      problems.push(`scene "${scene.sceneId}" appears twice`);
    }
    seen.add(scene.sceneId);
    if (isSceneFlagged(scene) && scene.note.length === 0) {
      problems.push(`scene "${scene.sceneId}" is flagged and needs a note saying what to fix`);
    }
  }
  for (const frame of frames) {
    if (!seen.has(frame.sceneId)) {
      problems.push(`scene "${frame.sceneId}" is missing`);
    }
  }
  return problems;
}

function sceneProblems(scene: SceneVisualReview): string[] {
  return [
    ...(scene.verdict === 'fix' ? ['marcada para corregir'] : []),
    ...(scene.matchesVoice ? [] : ['no coincide con lo que dice la voz']),
    ...(scene.legible ? [] : ['no se lee bien']),
    ...(scene.couldBeOtherProduct ? ['podría ser de otro producto'] : []),
  ];
}

function flaggedSceneFinding(scene: SceneVisualReview, frame: SceneFrame | undefined, position: number): ReviewFinding {
  const where = frame === undefined ? scene.sceneId : `${scene.sceneId} (${frame.startSec.toFixed(1)}-${frame.endSec.toFixed(1)} s)`;
  const note = scene.note.length > 0 ? ` ${scene.note}` : '';
  return {
    id: `${VISUAL_REVIEW_CHECK}-${String(position).padStart(2, '0')}`,
    check: VISUAL_REVIEW_CHECK,
    severity: 'critical',
    message: `Escena ${where}: ${sceneProblems(scene).join(', ')}. Muestra: ${scene.shows}.${note}`,
    ...(frame === undefined ? {} : { timeRange: { startSec: frame.startSec, endSec: frame.endSec } }),
    proposedFix: scene.note.length > 0 ? scene.note : `Corregir la escena ${scene.sceneId} y volver a renderizar.`,
  };
}

export function withVisualReview(report: ReviewReport, recordedAt: string, draft: VisualReviewDraft): ReviewReport {
  const frames = report.sceneFrames ?? [];
  const visualReview: VisualReview = { recordedAt, scenes: draft.scenes };
  const flagged = draft.scenes
    .filter(isSceneFlagged)
    .map((scene, position) => flaggedSceneFinding(scene, frames.find((frame) => frame.sceneId === scene.sceneId), position + 1));
  const findings = [
    ...report.findings.filter((finding) => finding.check !== VISUAL_NOT_REVIEWED_CHECK && finding.check !== VISUAL_REVIEW_CHECK),
    ...flagged,
  ];
  return { ...report, findings, status: reviewStatusFor(findings), visualReview };
}
