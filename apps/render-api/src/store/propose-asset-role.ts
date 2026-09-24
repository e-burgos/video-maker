import type { AssetRole } from './asset-path';

export interface AssetProbeSummary {
  readonly kind: 'video' | 'image' | 'audio';
  readonly durationMs: number;
  readonly width?: number;
  readonly height?: number;
  readonly hasAudio?: boolean;
  readonly hasAlpha?: boolean;
}

export const PROPOSAL_REASON_CODES = [
  'has-audio',
  'no-audio',
  'alpha-channel',
  'image',
  'long-audio',
  'voice-name-hint',
  'music-name-hint',
  'short-audio',
] as const;

export type ProposalReasonCode = (typeof PROPOSAL_REASON_CODES)[number];

export interface AssetRoleProposal {
  readonly role: AssetRole;
  readonly reason: ProposalReasonCode;
}

export const LONG_AUDIO_THRESHOLD_MS = 45_000;

const VOICE_NAME_HINTS = ['voz', 'voice', 'locucion', 'narr'] as const;
const MUSIC_NAME_HINTS = ['music', 'musica', 'song', 'track', 'bgm'] as const;

function fileNameMatchesAny(fileName: string, hints: readonly string[]): boolean {
  const normalized = fileName.toLowerCase();
  return hints.some((hint) => normalized.includes(hint));
}

function proposeForVideo(probe: AssetProbeSummary): AssetRoleProposal {
  return probe.hasAudio === true
    ? { role: 'aroll', reason: 'has-audio' }
    : { role: 'broll', reason: 'no-audio' };
}

function proposeForImage(probe: AssetProbeSummary): AssetRoleProposal {
  return probe.hasAlpha === true ? { role: 'logo', reason: 'alpha-channel' } : { role: 'image', reason: 'image' };
}

function proposeForAudio(probe: AssetProbeSummary, fileName: string): AssetRoleProposal {
  if (fileNameMatchesAny(fileName, VOICE_NAME_HINTS)) {
    return { role: 'voice', reason: 'voice-name-hint' };
  }
  if (fileNameMatchesAny(fileName, MUSIC_NAME_HINTS)) {
    return { role: 'audio', reason: 'music-name-hint' };
  }
  return probe.durationMs > LONG_AUDIO_THRESHOLD_MS
    ? { role: 'audio', reason: 'long-audio' }
    : { role: 'voice', reason: 'short-audio' };
}

export function proposeAssetRole(probe: AssetProbeSummary, fileName: string): AssetRoleProposal {
  if (probe.kind === 'video') {
    return proposeForVideo(probe);
  }
  if (probe.kind === 'image') {
    return proposeForImage(probe);
  }
  return proposeForAudio(probe, fileName);
}
