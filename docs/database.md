# データベース設計

MemoEZ は `expo-sqlite` と Drizzle ORM を使用してデバイスローカルに SQLite データベースを管理します。FTS5（全文検索）も有効化しています。

## DB 初期化フロー

アプリ起動時、`app/_layout.tsx` のルートレイアウトで `initDatabase()` が呼ばれます。

```
アプリ起動
  │
  ▼
initDatabase()   ← src/data/db/client.ts
  │
  ├─ SQLite DB をオープン（expo-sqlite）
  ├─ PRAGMA journal_mode = WAL
  ├─ PRAGMA foreign_keys = ON
  ├─ BOOTSTRAP_SQL を実行
  │    └─ FTS5 仮想テーブル (notes_fts) の作成
  │    └─ notes への INSERT/UPDATE/DELETE トリガー作成
  ├─ Drizzle マイグレーション実行（migrations/ 以下の SQL ファイル）
  │
  └─ migrateServerIds()
       └─ server_id が NULL のノートに UUID v4 を一括補完
```

### migrateServerIds()

`serverId` カラムは同期拡張のために後から追加されたため、既存ノートには `NULL` が入っている可能性があります。`migrateServerIds()` は起動時に一度だけ実行され、`server_id IS NULL` のレコードを検出して UUID v4 を補完します。

```sql
UPDATE notes
SET server_id = '<uuid>'
WHERE server_id IS NULL;
```

## テーブル定義

### `notes`

メモの本体テーブルです。

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | TEXT (PK) | UUID v4。クライアント生成 |
| `title` | TEXT | メモのタイトル（空文字可） |
| `content` | TEXT | メモ本文（空文字可） |
| `color` | TEXT | メモのカラーコード（hex 文字列） |
| `is_pinned` | INTEGER | ピン留め状態。1 = ピン留め / 0 = 通常 |
| `sort_weight` | REAL | ピン留めソートの重み。`sortWeight.ts` で計算 |
| `is_checklist` | INTEGER | チェックリスト形式フラグ。1 = チェックリスト |
| `deleted_at` | INTEGER | 論理削除日時（Unix ミリ秒）。NULL = 通常メモ |
| `created_at` | INTEGER | 作成日時（Unix ミリ秒） |
| `updated_at` | INTEGER | 更新日時（Unix ミリ秒） |
| `server_id` | TEXT | サーバー同期用 UUID。将来の同期拡張に使用 |
| `synced_at` | INTEGER | 最終同期日時（Unix ミリ秒）。NULL = 未同期 |

### `checklist_items`

チェックリストアイテムのテーブルです。`notes` と 1 対多の関係です。

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | TEXT (PK) | UUID v4 |
| `note_id` | TEXT (FK) | 親ノードの `notes.id` |
| `text` | TEXT | チェックアイテムのテキスト |
| `is_checked` | INTEGER | チェック状態。1 = チェック済み / 0 = 未チェック |
| `position` | INTEGER | 表示順序 |
| `created_at` | INTEGER | 作成日時（Unix ミリ秒） |
| `updated_at` | INTEGER | 更新日時（Unix ミリ秒） |

### `labels`

ラベルのマスターテーブルです。

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | TEXT (PK) | UUID v4 |
| `name` | TEXT (UNIQUE) | ラベル名。重複不可 |
| `color` | TEXT | ラベルのカラーコード |
| `created_at` | INTEGER | 作成日時（Unix ミリ秒） |
| `updated_at` | INTEGER | 更新日時（Unix ミリ秒） |

### `note_labels`（中間テーブル）

メモとラベルの多対多関係を管理します。

| カラム | 型 | 説明 |
|--------|-----|------|
| `note_id` | TEXT (FK) | `notes.id` |
| `label_id` | TEXT (FK) | `labels.id` |

複合主キー: `(note_id, label_id)`

### `notes_fts`（FTS5 仮想テーブル）

全文検索用の仮想テーブルです。`BOOTSTRAP_SQL` で作成されます。

```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
  id UNINDEXED,
  title,
  content,
  content='notes',
  content_rowid='rowid'
);
```

`notes` テーブルへの INSERT / UPDATE / DELETE トリガーにより自動で同期されます。

## マイグレーション方針

### Drizzle Kit による自動生成

スキーマ変更は `src/data/db/schema.ts` を編集した後、以下のコマンドで SQL ファイルを生成します。

```bash
npm run generate
# drizzle-kit generate が実行され、
# src/data/db/migrations/ に SQL ファイルが追加されます
```

### BOOTSTRAP_SQL の役割

Drizzle が生成できない SQL（FTS 仮想テーブル・トリガー等）は `schema.ts` の `BOOTSTRAP_SQL` 定数に記述し、`initDatabase()` で毎回 `IF NOT EXISTS` 付きで実行します。これにより冪等性が保たれます。

```typescript
// src/data/db/schema.ts
export const BOOTSTRAP_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(...);
  CREATE TRIGGER IF NOT EXISTS notes_fts_insert ...;
  CREATE TRIGGER IF NOT EXISTS notes_fts_update ...;
  CREATE TRIGGER IF NOT EXISTS notes_fts_delete ...;
`;
```

### マイグレーションファイルの管理

- `src/data/db/migrations/` 以下に連番の SQL ファイルとして管理
- Drizzle の `migrate()` 関数がアプリ起動時に未適用ファイルを自動実行
- 一度適用したマイグレーションは変更しない（新しいファイルを追加する）

## 論理削除と物理削除の使い分け

### 論理削除（ソフトデリート）

`notes.deleted_at` カラムに削除日時を設定することで削除済みとして扱います。

```sql
-- 論理削除
UPDATE notes SET deleted_at = <unix_ms> WHERE id = ?;

-- 通常の一覧取得（削除済みを除外）
SELECT * FROM notes WHERE deleted_at IS NULL;
```

**用途**: ユーザーがゴミ箱機能や削除取り消しを利用できる場合の削除操作。将来のサーバー同期でも、削除情報をサーバーに伝えるために使用。

### 物理削除（ハードデリート）

`DELETE FROM notes WHERE id = ?` で DB からレコードを完全に削除します。`INoteRepository` では `hardDelete()` として明示的に区別されています。

**用途**: ゴミ箱から完全削除する操作、または即時削除が確定している場合。

### 設計の意図

| 操作 | 方式 | 理由 |
|------|------|------|
| 一般的な削除 | 論理削除 | 誤削除の復元・将来のサーバー同期での tombstone 活用 |
| 完全削除 | 物理削除 | プライバシー配慮・ストレージ解放 |
| チェックリストアイテムの削除 | 物理削除 | 親ノートの削除に従属するため論理削除不要 |
| ラベルの削除 | 物理削除 | `note_labels` の CASCADE DELETE で関連を自動削除 |
