import type { ServiceHealth } from './render-api-types';

export const MONTAGE_BINARY_NAMES = ['ffmpeg', 'ffprobe', 'whisperCli', 'whisperModel'] as const;

export type MontageBinaryName = (typeof MONTAGE_BINARY_NAMES)[number];

function isMontageBinaryName(name: string): name is MontageBinaryName {
  return (MONTAGE_BINARY_NAMES as readonly string[]).includes(name);
}

export function montageBlockers(health: ServiceHealth | null): string[] {
  if (health === null) {
    return ['The render service health is unknown, so the montage cannot be started.'];
  }

  const blockers: string[] = [];

  if (!health.capabilities.montageQueue) {
    blockers.push('The render service does not expose a montage queue.');
  }

  health.binaries
    .filter((binary) => isMontageBinaryName(binary.name) && !binary.resolved)
    .forEach((binary) => blockers.push(`${binary.name} is not resolved (${binary.envVar}).`));

  return blockers;
}

export function canGenerateMontage(health: ServiceHealth | null): boolean {
  return montageBlockers(health).length === 0;
}
