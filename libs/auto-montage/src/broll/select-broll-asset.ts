import type { BrollRolePriority, MontagePreset } from '../presets/montage-preset';
import type { BrollCandidate } from './build-broll-index';

function rolePriorityIndex(role: BrollCandidate['role'], rolePriority: BrollRolePriority): number {
  return rolePriority.indexOf(role);
}

function compareCandidates(
  left: BrollCandidate,
  right: BrollCandidate,
  rolePriority: BrollRolePriority,
): number {
  const leftRoleIndex = rolePriorityIndex(left.role, rolePriority);
  const rightRoleIndex = rolePriorityIndex(right.role, rolePriority);
  if (leftRoleIndex !== rightRoleIndex) {
    return leftRoleIndex - rightRoleIndex;
  }

  if (left.tokens.size !== right.tokens.size) {
    return left.tokens.size - right.tokens.size;
  }

  return left.assetId < right.assetId ? -1 : 1;
}

export function selectBrollAsset(
  term: string,
  index: readonly BrollCandidate[],
  preset: MontagePreset,
): BrollCandidate | undefined {
  let best: BrollCandidate | undefined;

  for (const candidate of index) {
    if (!candidate.tokens.has(term)) {
      continue;
    }
    if (best === undefined || compareCandidates(candidate, best, preset.broll.rolePriority) < 0) {
      best = candidate;
    }
  }

  return best;
}
