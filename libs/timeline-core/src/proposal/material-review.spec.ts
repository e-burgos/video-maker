import { describe, expect, it } from 'vitest';

import { MaterialReviewDraftSchema, canonicalMaterialPath, MaterialReviewSchema, materialReviewFrom, materialWarnings } from './material-review';
import { ProductionProposalSchema, pendingProposalFrom } from './production-proposal';
import type { MaterialReviewItem } from './material-review';

const NOW = '2026-10-12T10:00:00.000Z';

function item(file: string, overrides: Partial<MaterialReviewItem> = {}): MaterialReviewItem {
  return {
    file,
    source: file.startsWith('brand:') ? 'brand' : 'project',
    shows: 'Un equipo sobre una mesa',
    verdict: 'fits',
    reason: 'Se ve el equipo completo',
    ...overrides,
  };
}

const CONCEPT = {
  id: 'directo',
  title: 'Directo',
  angle: 'Paso a paso',
  format: 'youtube-16x9' as const,
  durationSec: 60,
  scenes: 6,
  delivery: { kind: 'tutorial' as const, requiresVoice: true },
};
const DRAFT = { recommendedId: 'directo', concepts: [CONCEPT, { ...CONCEPT, id: 'reel' }] };

describe('MaterialReviewSchema', () => {
  it('accepts a review with project and brand items and gaps', () => {
    const review = materialReviewFrom(
      { items: [item('images/a.png'), item('brand:counter-15', { verdict: 'unfit', reason: 'Muestra un menú de comida' })], gaps: [{ need: 'Easy Pro conectado a un TV', note: 'Ninguna foto lo muestra' }] },
      NOW,
    );

    expect(MaterialReviewSchema.safeParse(review).success).toBe(true);
    expect(Object.keys(review).sort()).toEqual(['gaps', 'items', 'reviewedAt', 'version']);
  });

  it.each([
    ['brand file with project source', { items: [item('brand:x', { source: 'project' })], gaps: [] }],
    ['project file with brand source', { items: [item('images/x.png', { source: 'brand' })], gaps: [] }],
    ['unknown verdict', { items: [item('images/x.png', { verdict: 'great' as never })], gaps: [] }],
    ['path escaping the project', { items: [item('../x.png')], gaps: [] }],
    ['the same file twice', { items: [item('images/x.png'), item('images/x.png')], gaps: [] }],
    ['missing gaps', { items: [] }],
    ['unknown key', { items: [], gaps: [], extra: 1 }],
  ])('rejects %s', (_label, draft) => {
    expect(MaterialReviewDraftSchema.safeParse(draft).success).toBe(false);
  });
});

describe('materialWarnings', () => {
  it('keeps unfit and doubtful items and every gap, and drops the ones that fit', () => {
    const review = materialReviewFrom(
      { items: [item('images/ok.png'), item('images/dud.png', { verdict: 'doubtful' }), item('brand:bad', { verdict: 'unfit' })], gaps: [{ need: 'TV', note: 'falta' }] },
      NOW,
    );

    const warnings = materialWarnings(review);

    expect(warnings.items.map((entry) => entry.file)).toEqual(['images/dud.png', 'brand:bad']);
    expect(warnings.gaps).toEqual([{ need: 'TV', note: 'falta' }]);
  });
});

describe('ProductionProposalSchema with material warnings', () => {
  it('stays valid without warnings and carries them when the review has any', () => {
    expect(pendingProposalFrom(DRAFT)).not.toHaveProperty('materialWarnings');

    const warnings = { items: [item('brand:bad', { verdict: 'unfit' })], gaps: [] };
    const proposal = pendingProposalFrom(DRAFT, warnings);

    expect(ProductionProposalSchema.safeParse(proposal).success).toBe(true);
    expect(proposal.materialWarnings).toEqual(warnings);
  });

  it('omits empty warnings', () => {
    expect(pendingProposalFrom(DRAFT, { items: [], gaps: [] })).not.toHaveProperty('materialWarnings');
  });
});

describe('canonicalMaterialPath', () => {
  it('expands the storyboard alias images/<file> to the project path and leaves everything else', () => {
    expect(canonicalMaterialPath('images/a.png')).toBe('raw/images/a.png');
    expect(canonicalMaterialPath('raw/images/a.png')).toBe('raw/images/a.png');
    expect(canonicalMaterialPath('brand:counter-15')).toBe('brand:counter-15');
  });
});
