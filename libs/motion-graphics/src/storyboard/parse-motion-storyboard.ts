import { z } from 'zod';

import { MotionStudioError } from '../errors/motion-studio-error';
import { MotionStoryboardSchema } from './motion-storyboard.schema';
import type { MotionStoryboard } from './motion-storyboard.schema';

export function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, key) => (typeof key === 'number' ? `${acc}[${key}]` : acc === '' ? String(key) : `${acc}.${String(key)}`), '');
}

export function parseMotionStoryboard(raw: unknown): MotionStoryboard {
  const result = MotionStoryboardSchema.safeParse(raw);
  if (result.success) return result.data;
  const lines = result.error.issues.slice(0, 8).map((issue) => `${formatIssuePath(issue.path) || 'storyboard'}: ${issue.message}`);
  throw new MotionStudioError('STORYBOARD_INVALID', `storyboard.json is invalid:\n  ${lines.join('\n  ')}`);
}

const JSON_SCHEMA_IDENTITY_KEYS = ['$schema', '$id'];

export function motionStoryboardJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(MotionStoryboardSchema, { target: 'draft-2020-12', io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(schema).filter(([key]) => !JSON_SCHEMA_IDENTITY_KEYS.includes(key)));
}
