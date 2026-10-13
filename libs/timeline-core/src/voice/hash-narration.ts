import { hasVoiceDirection } from './voice-direction';
import type { VoiceDirection } from './voice-direction';

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;
const HASH_HEX_LENGTH = 16;

export function hashNarration(narration: string): string {
  const bytes = new TextEncoder().encode(narration);
  let hash = FNV_OFFSET_BASIS;

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }

  return hash.toString(16).padStart(HASH_HEX_LENGTH, '0');
}

function canonicalDirection(direction: VoiceDirection): string {
  return JSON.stringify(Object.fromEntries(Object.entries(direction).sort(([left], [right]) => left.localeCompare(right))));
}

export function hashDirectedNarration(narration: string, direction: VoiceDirection | undefined): string {
  return hasVoiceDirection(direction) ? hashNarration(`${narration}\u0000${canonicalDirection(direction)}`) : hashNarration(narration);
}
