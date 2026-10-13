import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { isNull, eq } from 'drizzle-orm';
import * as schema from './schema';
import { BOOTSTRAP_SQL, notes } from './schema';
import { generateUUID } from '@/lib/uuid';

const DB_NAME = 'memoez.db';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
// 初期化処理の共有。通常画面とフローティングエディタ（ウィジェット）は同じ JS ランタイムで
// 動くため、どちらが先に起動しても DB を開くのは 1 回だけにする。
let _initPromise: Promise<void> | null = null;

/** DB インスタンスを返す (シングルトン) */
export function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return _db;
}

/**
 * アプリ起動時に呼ぶ。2 回目以降は初回の初期化結果を共有する（失敗時のみ再試行できる）。
 */
export function initDatabase(): Promise<void> {
  if (!_initPromise) {
    _initPromise = openDatabase().catch((e: unknown) => {
      _initPromise = null;
      throw e;
    });
  }
  return _initPromise;
}

async function openDatabase(): Promise<void> {
  const sqlite = SQLite.openDatabaseSync(DB_NAME);

  sqlite.execSync('PRAGMA journal_mode = WAL;');
  sqlite.execSync('PRAGMA foreign_keys = ON;');

  // テーブル・インデックス作成 (idempotent) — DDL は schema.ts で一元管理
  for (const stmt of BOOTSTRAP_SQL) {
    sqlite.execSync(stmt);
  }

  // ALTER TABLE は drizzle インスタンス生成前に済ませる（列不足のクエリを防ぐ）
  migrateNoteDueColumns(sqlite);

  _db = drizzle(sqlite, { schema });

  // 既存ノートに serverId が未設定のものがあれば一括生成（同期対応準備）
  await migrateServerIds();
}

/** 既存DBへ due_at / reminder_at を後方互換で追加する */
function migrateNoteDueColumns(sqlite: SQLite.SQLiteDatabase): void {
  const columns = sqlite.getAllSync<{ name: string }>(`PRAGMA table_info('notes')`);
  const columnNames = new Set(columns.map((col) => col.name));

  if (!columnNames.has('due_at')) {
    sqlite.execSync('ALTER TABLE notes ADD COLUMN due_at INTEGER');
  }

  if (!columnNames.has('reminder_at')) {
    sqlite.execSync('ALTER TABLE notes ADD COLUMN reminder_at INTEGER');
  }
}

/** アップデート時に既存ノートへ serverId を付与する */
async function migrateServerIds(): Promise<void> {
  const db = _db;
  if (!db) return;
  const nullRows = await db
    .select({ id: notes.id })
    .from(notes)
    .where(isNull(notes.serverId));
  if (nullRows.length === 0) return;

  // 1件ずつ別トランザクションで書くと起動が遅くなるため、まとめてコミットする
  await db.transaction(async (tx) => {
    for (const row of nullRows) {
      await tx.update(notes)
        .set({ serverId: generateUUID() })
        .where(eq(notes.id, row.id));
    }
  });
}
