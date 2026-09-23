import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { settings } from '../schema/studio-schema';
import type * as schema from '../schema/studio-schema';

export type SettingsClock = () => string;

const defaultClock: SettingsClock = () => new Date().toISOString();

export function createSettingsRepository(
  db: BetterSQLite3Database<typeof schema>,
  clock: SettingsClock = defaultClock,
) {
  function get(key: string): unknown | null {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row === undefined ? null : (JSON.parse(row.value) as unknown);
  }

  function set(key: string, value: unknown): void {
    const updatedAt = clock();
    db
      .insert(settings)
      .values({ key, value: JSON.stringify(value), updatedAt })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: JSON.stringify(value), updatedAt },
      })
      .run();
  }

  function remove(key: string): void {
    db.delete(settings).where(eq(settings.key, key)).run();
  }

  return { get, set, delete: remove };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
