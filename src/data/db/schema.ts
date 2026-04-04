import {
  sqliteTable,
  integer,
  text,
  real,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';

// ─── notes ────────────────────────────────────────────────────────────────────

export const notes = sqliteTable(
  'notes',
  {
    id:         integer('id').primaryKey({ autoIncrement: true }),
    title:      text('title').notNull().default(''),
    content:    text('content').notNull().default(''),
    type:       text('type', { enum: ['TEXT', 'CHECKLIST'] })
                  .notNull()
                  .default('TEXT'),
    color:      text('color', {
                  enum: ['NONE','RED','ORANGE','YELLOW','GREEN','TEAL','BLUE','PURPLE'],
                })
                  .notNull()
                  .default('NONE'),
    isPinned:   integer('is_pinned',   { mode: 'boolean' }).notNull().default(false),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    sortWeight: real('sort_weight').notNull().default(0),
    createdAt:  integer('created_at',  { mode: 'timestamp_ms' }).notNull(),
    updatedAt:  integer('updated_at',  { mode: 'timestamp_ms' }).notNull(),
    deletedAt:  integer('deleted_at',  { mode: 'timestamp_ms' }),
    serverId:   text('server_id'),   // 将来の同期用
    syncedAt:   integer('synced_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    index('idx_notes_updated_at').on(t.updatedAt),
    index('idx_notes_is_pinned').on(t.isPinned, t.sortWeight),
  ],
);

// ─── checklist_items ──────────────────────────────────────────────────────────

export const checklistItems = sqliteTable(
  'checklist_items',
  {
    id:        integer('id').primaryKey({ autoIncrement: true }),
    noteId:    integer('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
    text:      text('text').notNull().default(''),
    isChecked: integer('is_checked', { mode: 'boolean' }).notNull().default(false),
    position:  integer('position').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    index('idx_checklist_note_id').on(t.noteId, t.position),
  ],
);

// ─── labels ───────────────────────────────────────────────────────────────────

export const labels = sqliteTable(
  'labels',
  {
    id:        integer('id').primaryKey({ autoIncrement: true }),
    name:      text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    index('idx_labels_name').on(t.name),
  ],
);

// ─── note_labels (junction) ──────────────────────────────────────────────────

export const noteLabels = sqliteTable(
  'note_labels',
  {
    noteId:  integer('note_id').notNull().references(() => notes.id,  { onDelete: 'cascade' }),
    labelId: integer('label_id').notNull().references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.noteId, t.labelId] }),
    index('idx_note_labels_label_id').on(t.labelId),
  ],
);

// ─── Bootstrap DDL (client.ts から参照) ───────────────────────────────────────
// テーブル定義の唯一の真実はここ。client.ts に SQL を書かない。
export const BOOTSTRAP_SQL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL DEFAULT '',
    content     TEXT    NOT NULL DEFAULT '',
    type        TEXT    NOT NULL DEFAULT 'TEXT',
    color       TEXT    NOT NULL DEFAULT 'NONE',
    is_pinned   INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    sort_weight REAL    NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER,
    server_id   TEXT,
    synced_at   INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS checklist_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id    INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    text       TEXT    NOT NULL DEFAULT '',
    is_checked INTEGER NOT NULL DEFAULT 0,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS labels (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS note_labels (
    note_id  INTEGER NOT NULL REFERENCES notes(id)  ON DELETE CASCADE,
    label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, label_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notes_updated_at  ON notes(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_is_pinned   ON notes(is_pinned DESC, sort_weight DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_checklist_note_id ON checklist_items(note_id, position ASC)`,
  `CREATE INDEX IF NOT EXISTS idx_note_labels_lid   ON note_labels(label_id)`,
] as const;
