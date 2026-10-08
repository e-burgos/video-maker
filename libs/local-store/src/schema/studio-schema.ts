import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { ProjectMode } from './project-mode';

export const projects = sqliteTable('projects', {
  slug: text('slug').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  importedAt: text('imported_at'),
  mode: text('mode').$type<ProjectMode>().notNull().default('footage'),
  brand: text('brand'),
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
    usage: text('usage'),
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

export const assets = sqliteTable(
  'assets',
  {
    id: text('id').primaryKey(),
    slug: text('slug')
      .notNull()
      .references(() => projects.slug, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    fileName: text('file_name').notNull(),
    proposedRole: text('proposed_role').notNull(),
    proposalReason: text('proposal_reason').notNull(),
    confirmedRole: text('confirmed_role'),
    status: text('status').notNull(),
    probe: text('probe').notNull(),
    createdAt: text('created_at').notNull(),
    confirmedAt: text('confirmed_at'),
  },
  (table) => [index('assets_slug_status_idx').on(table.slug, table.status)],
);

export const publications = sqliteTable(
  'publications',
  {
    id: text('id').primaryKey(),
    slug: text('slug')
      .notNull()
      .references(() => projects.slug, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    file: text('file').notNull(),
    title: text('title').notNull(),
    videoId: text('video_id'),
    url: text('url'),
    privacy: text('privacy').notNull(),
    status: text('status').notNull(),
    publishAt: text('publish_at'),
    publishedAt: text('published_at'),
    jobId: text('job_id'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('publications_slug_created_at_idx').on(table.slug, table.createdAt)],
);
