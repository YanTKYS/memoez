import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { BOOTSTRAP_SQL } from './schema';

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

  // テーブル・インデックス作成 (idempotent) — DDL は schema.ts で一元管理
  for (const stmt of BOOTSTRAP_SQL) {
    sqlite.execSync(stmt);
  }

  _db = drizzle(sqlite, { schema });
}
