import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  slug: text('slug').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  importedAt: text('imported_at'),
});

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  position: integer('position').notNull(),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  folderId: text('folder_id')
    .notNull()
    .references(() => folders.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull(),
});

export const placements = sqliteTable('placements', {
  slug: text('slug')
    .primaryKey()
    .references(() => projects.slug, { onDelete: 'cascade' }),
  folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const producerSessions = sqliteTable('producer_sessions', {
  slug: text('slug')
    .primaryKey()
    .references(() => projects.slug, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  model: text('model').notNull(),
  startedAt: text('started_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const producerMessages = sqliteTable(
  'producer_messages',
  {
    id: text('id').primaryKey(),
    slug: text('slug')
      .notNull()
      .references(() => projects.slug, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    role: text('role').notNull(),
    text: text('text').notNull(),
    suggestions: text('suggestions'),
    turnId: text('turn_id'),
    model: text('model'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('producer_messages_slug_seq_unique').on(table.slug, table.seq)],
);

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    slug: text('slug')
      .notNull()
      .references(() => projects.slug, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    state: text('state').notNull(),
    params: text('params').notNull(),
    progress: text('progress'),
    report: text('report'),
    error: text('error'),
    retryOf: text('retry_of'),
    createdAt: text('created_at').notNull(),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
  },
  (table) => [index('jobs_slug_created_at_idx').on(table.slug, table.createdAt)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
