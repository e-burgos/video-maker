import { MUSIC_FLOOR_DB_DEFAULT, MUSIC_FLOOR_DB_MAX, MUSIC_FLOOR_DB_MIN } from './motion-types';

export function parseFloorDb(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/u.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  return value >= MUSIC_FLOOR_DB_MIN && value <= MUSIC_FLOOR_DB_MAX ? value : null;
}

export function floorDbIssue(text: string): boolean {
  return parseFloorDb(text) === null;
}

export function floorTextOf(floorDb: number | undefined): string {
  return String(floorDb ?? MUSIC_FLOOR_DB_DEFAULT);
}
