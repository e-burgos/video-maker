import { z } from 'zod';

import { IdSchema, MsSchema, ScaleSchema } from './primitives';
import { OutputFormatSchema } from './output-format.schema';

type IssueCtx = z.core.$RefinementCtx<unknown>;

export const CutReasonSchema = z.enum(['silence', 'manual', 'filler-word']);
export const BrollFitSchema = z.enum(['cover', 'contain', 'pip']);
export const PunchInAnchorSchema = z.enum(['center', 'top', 'face-hint']);
export const TransitionKindSchema = z.enum(['fade', 'slide', 'whip-pan', 'light-leak']);
export const TransitionDirectionSchema = z.enum([
  'from-left',
  'from-right',
  'from-top',
  'from-bottom',
]);
export const TransitionTimingKindSchema = z.enum(['spring', 'linear']);

export const KeepDecisionSchema = z.strictObject({
  id: IdSchema,
  type: z.literal('keep'),
  startMs: MsSchema,
  endMs: MsSchema,
});

export const CutDecisionSchema = z.strictObject({
  id: IdSchema,
  type: z.literal('cut'),
  startMs: MsSchema,
  endMs: MsSchema,
  reason: CutReasonSchema,
});

export const PunchInDecisionSchema = z.strictObject({
  id: IdSchema,
  type: z.literal('punch-in'),
  startMs: MsSchema,
  endMs: MsSchema,
  scale: ScaleSchema,
  anchor: PunchInAnchorSchema.optional(),
});

export const BrollOverlayDecisionSchema = z.strictObject({
  id: IdSchema,
  type: z.literal('broll-overlay'),
  startMs: MsSchema,
  endMs: MsSchema,
  assetId: IdSchema,
  fit: BrollFitSchema,
  keepVoice: z.boolean().meta({ default: true }).optional(),
});

export const TransitionDecisionSchema = z.strictObject({
  id: IdSchema,
  type: z.literal('transition'),
  atMs: MsSchema,
  durationMs: z.number().int().min(1),
  kind: TransitionKindSchema,
  direction: TransitionDirectionSchema.optional(),
  timing: TransitionTimingKindSchema.optional(),
});

export const CaptionGroupWordSchema = z.strictObject({
  text: z.string().min(1),
  startMs: MsSchema,
  endMs: MsSchema,
});

export const CaptionGroupDecisionSchema = z.strictObject({
  id: IdSchema,
  type: z.literal('caption-group'),
  startMs: MsSchema,
  endMs: MsSchema,
  words: z.array(CaptionGroupWordSchema).min(1).max(3),
  emphasisIndex: z.number().int().min(0).max(2).optional(),
});

export const DuckDecisionSchema = z.strictObject({
  id: IdSchema,
  type: z.literal('duck'),
  startMs: MsSchema,
  endMs: MsSchema,
  gainDb: z.number().max(0),
});

export const EditDecisionSchema = z.discriminatedUnion('type', [
  KeepDecisionSchema,
  CutDecisionSchema,
  PunchInDecisionSchema,
  BrollOverlayDecisionSchema,
  TransitionDecisionSchema,
  CaptionGroupDecisionSchema,
  DuckDecisionSchema,
]);

export type CutReason = z.infer<typeof CutReasonSchema>;
export type KeepDecision = z.infer<typeof KeepDecisionSchema>;
export type CutDecision = z.infer<typeof CutDecisionSchema>;
export type PunchInDecision = z.infer<typeof PunchInDecisionSchema>;
export type BrollOverlayDecision = z.infer<typeof BrollOverlayDecisionSchema>;
export type TransitionDecision = z.infer<typeof TransitionDecisionSchema>;
export type CaptionGroupDecision = z.infer<typeof CaptionGroupDecisionSchema>;
export type DuckDecision = z.infer<typeof DuckDecisionSchema>;
export type EditDecision = z.infer<typeof EditDecisionSchema>;

const OVERLAY_TYPES_REQUIRING_KEEP = new Set<EditDecision['type']>([
  'punch-in',
  'broll-overlay',
  'caption-group',
  'duck',
]);

function hasStartAndEnd(
  decision: EditDecision,
): decision is Exclude<EditDecision, TransitionDecision> {
  return decision.type !== 'transition';
}

function requiresEnclosingKeep(
  decision: EditDecision,
): decision is PunchInDecision | BrollOverlayDecision | CaptionGroupDecision | DuckDecision {
  return OVERLAY_TYPES_REQUIRING_KEEP.has(decision.type);
}

function validateUniqueIds(decisions: readonly EditDecision[], ctx: IssueCtx): void {
  const firstIndexById = new Map<string, number>();

  decisions.forEach((decision, index) => {
    const firstIndex = firstIndexById.get(decision.id);
    if (firstIndex !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['decisions', index, 'id'],
        message: `El id "${decision.id}" ya fue usado en la decisión del índice ${firstIndex}.`,
      });
      return;
    }
    firstIndexById.set(decision.id, index);
  });
}

function validateEndAfterStart(decisions: readonly EditDecision[], ctx: IssueCtx): void {
  decisions.forEach((decision, index) => {
    if (!hasStartAndEnd(decision)) {
      return;
    }
    if (decision.endMs <= decision.startMs) {
      ctx.addIssue({
        code: 'custom',
        path: ['decisions', index, 'endMs'],
        message: `La decisión "${decision.id}" tiene endMs menor o igual que startMs.`,
      });
    }
  });
}

function validateKeepCutPartition(decisions: readonly EditDecision[], ctx: IssueCtx): void {
  const keepCutRanges = decisions
    .map((decision, index) => ({ decision, index }))
    .filter(
      (entry): entry is { decision: KeepDecision | CutDecision; index: number } =>
        entry.decision.type === 'keep' || entry.decision.type === 'cut',
    )
    .sort((a, b) => a.decision.startMs - b.decision.startMs);

  let expectedStartMs = 0;
  for (const { decision, index } of keepCutRanges) {
    if (decision.startMs !== expectedStartMs) {
      ctx.addIssue({
        code: 'custom',
        path: ['decisions', index, 'startMs'],
        message: `La partición de keep/cut tiene un hueco o solape en startMs=${decision.startMs}; se esperaba ${expectedStartMs}.`,
      });
      return;
    }
    expectedStartMs = decision.endMs;
  }
}

function findEnclosingKeep(
  keeps: readonly KeepDecision[],
  startMs: number,
  endMs: number,
): KeepDecision | undefined {
  return keeps.find((keep) => startMs >= keep.startMs && endMs <= keep.endMs);
}

function validateOverlaysWithinKeep(decisions: readonly EditDecision[], ctx: IssueCtx): void {
  const keeps = decisions.filter((decision): decision is KeepDecision => decision.type === 'keep');

  decisions.forEach((decision, index) => {
    if (!requiresEnclosingKeep(decision)) {
      return;
    }
    if (findEnclosingKeep(keeps, decision.startMs, decision.endMs) === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['decisions', index],
        message: `La decisión "${decision.id}" (${decision.type}) debe caer completa dentro de un único keep.`,
      });
    }
  });
}

function validateTransitionAtKeepBoundary(decisions: readonly EditDecision[], ctx: IssueCtx): void {
  const keepsByStart = decisions
    .filter((decision): decision is KeepDecision => decision.type === 'keep')
    .slice()
    .sort((a, b) => a.startMs - b.startMs);
  const boundaryStartMs = new Set(keepsByStart.slice(1).map((keep) => keep.startMs));

  decisions.forEach((decision, index) => {
    if (decision.type !== 'transition') {
      return;
    }
    if (!boundaryStartMs.has(decision.atMs)) {
      ctx.addIssue({
        code: 'custom',
        path: ['decisions', index, 'atMs'],
        message: `La transición "${decision.id}" debe coincidir con el startMs de un keep posterior al primero.`,
      });
    }
  });
}

function validatePunchInsDontOverlap(decisions: readonly EditDecision[], ctx: IssueCtx): void {
  const punchIns = decisions
    .map((decision, index) => ({ decision, index }))
    .filter(
      (entry): entry is { decision: PunchInDecision; index: number } =>
        entry.decision.type === 'punch-in',
    )
    .sort((a, b) => a.decision.startMs - b.decision.startMs);

  punchIns.forEach((current, sortedIndex) => {
    const previous = punchIns[sortedIndex - 1];
    if (previous === undefined) {
      return;
    }
    if (current.decision.startMs < previous.decision.endMs) {
      ctx.addIssue({
        code: 'custom',
        path: ['decisions', current.index, 'startMs'],
        message: `El punch-in "${current.decision.id}" se solapa con "${previous.decision.id}".`,
      });
    }
  });
}

function validateCaptionGroupEmphasisIndex(decisions: readonly EditDecision[], ctx: IssueCtx): void {
  decisions.forEach((decision, index) => {
    if (decision.type !== 'caption-group' || decision.emphasisIndex === undefined) {
      return;
    }
    if (decision.emphasisIndex >= decision.words.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['decisions', index, 'emphasisIndex'],
        message: `emphasisIndex de "${decision.id}" debe ser menor que la cantidad de palabras.`,
      });
    }
  });
}

function validateCaptionGroupWords(decisions: readonly EditDecision[], ctx: IssueCtx): void {
  decisions.forEach((decision, index) => {
    if (decision.type !== 'caption-group') {
      return;
    }

    let previousEndMs = decision.startMs;
    decision.words.forEach((word, wordIndex) => {
      const isOrdered = word.startMs >= previousEndMs;
      const isWithinRange = word.startMs >= decision.startMs && word.endMs <= decision.endMs;

      if (!isOrdered || !isWithinRange) {
        ctx.addIssue({
          code: 'custom',
          path: ['decisions', index, 'words', wordIndex, 'startMs'],
          message: `La palabra "${word.text}" de "${decision.id}" debe estar ordenada y dentro de [${decision.startMs}, ${decision.endMs}].`,
        });
      }

      previousEndMs = word.endMs;
    });
  });
}

export const EditDecisionListSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    sourceAssetId: IdSchema,
    format: OutputFormatSchema,
    generatedBy: z.object({
      tool: z.string(),
      params: z.record(z.string(), z.json()),
    }),
    decisions: z.array(EditDecisionSchema),
  })
  .superRefine((edl, ctx) => {
    validateUniqueIds(edl.decisions, ctx);
    validateEndAfterStart(edl.decisions, ctx);
    validateKeepCutPartition(edl.decisions, ctx);
    validateOverlaysWithinKeep(edl.decisions, ctx);
    validateTransitionAtKeepBoundary(edl.decisions, ctx);
    validatePunchInsDontOverlap(edl.decisions, ctx);
    validateCaptionGroupEmphasisIndex(edl.decisions, ctx);
    validateCaptionGroupWords(edl.decisions, ctx);
  });

export type EditDecisionList = z.infer<typeof EditDecisionListSchema>;
