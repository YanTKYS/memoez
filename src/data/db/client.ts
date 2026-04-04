import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'memoez.db';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** DB インスタンスを返す (シングルトン) */
export function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return _db;
}

/** アプリ起動時に一度だけ呼ぶ */
export async function initDatabase(): Promise<void> {
  const sqlite = SQLite.openDatabaseSync(DB_NAME);

  sqlite.execSync('PRAGMA journal_mode = WAL;');
  sqlite.execSync('PRAGMA foreign_keys = ON;');

  // テーブル作成 (idempotent)
  sqlite.execSync(`
    CREATE TABLE IF NOT EXISTS notes (
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
    );
  `);

  sqlite.execSync(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id     INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      text        TEXT    NOT NULL DEFAULT '',
      is_checked  INTEGER NOT NULL DEFAULT 0,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL,
      deleted_at  INTEGER
    );
  `);

  sqlite.execSync(`
    CREATE TABLE IF NOT EXISTS labels (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      deleted_at  INTEGER
    );
  `);

  sqlite.execSync(`
    CREATE TABLE IF NOT EXISTS note_labels (
      note_id  INTEGER NOT NULL REFERENCES notes(id)  ON DELETE CASCADE,
      label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, label_id)
    );
  `);

  // インデックス
  sqlite.execSync(`CREATE INDEX IF NOT EXISTS idx_notes_updated_at  ON notes(updated_at DESC);`);
  sqlite.execSync(`CREATE INDEX IF NOT EXISTS idx_notes_is_pinned   ON notes(is_pinned DESC, sort_weight DESC);`);
  sqlite.execSync(`CREATE INDEX IF NOT EXISTS idx_checklist_note_id ON checklist_items(note_id, position ASC);`);
  sqlite.execSync(`CREATE INDEX IF NOT EXISTS idx_note_labels_lid   ON note_labels(label_id);`);

  _db = drizzle(sqlite, { schema });
}
