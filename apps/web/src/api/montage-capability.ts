import type { ServiceHealth } from './render-api-types';
import type { Blocker } from './blockers';

export const MONTAGE_BINARY_NAMES = ['ffmpeg', 'ffprobe', 'whisperCli', 'whisperModel'] as const;

export type MontageBinaryName = (typeof MONTAGE_BINARY_NAMES)[number];

function isMontageBinaryName(name: string): name is MontageBinaryName {
  return (MONTAGE_BINARY_NAMES as readonly string[]).includes(name);
}

export function montageBlockers(health: ServiceHealth | null): Blocker[] {
  if (health === null) {
    return [{ key: 'montage.blocker.healthUnknown' }];
  }

  const blockers: Blocker[] = [];

  if (!health.capabilities.montageQueue) {
    blockers.push({ key: 'montage.blocker.noQueue' });
  }

  health.binaries
    .filter((binary) => isMontageBinaryName(binary.name) && !binary.resolved)
    .forEach((binary) =>
      blockers.push({
        key: 'montage.blocker.binaryUnresolved',
        params: { name: binary.name, envVar: binary.envVar },
      }),
    );

  return blockers;
}

export function canGenerateMontage(health: ServiceHealth | null): boolean {
  return montageBlockers(health).length === 0;
}
