# データベース設計

MemoEZ は `expo-sqlite` と Drizzle ORM を使用してデバイスローカルに SQLite データベースを管理します。

## DB 初期化フロー

アプリ起動時、`app/_layout.tsx` のルートレイアウトで `initDatabase()` が呼ばれます。

```
アプリ起動
  │
  ▼
initDatabase()   ← src/data/db/client.ts
  │
  ├─ SQLite DB をオープン（expo-sqlite / memoez.db）
  ├─ PRAGMA journal_mode = WAL
  ├─ PRAGMA foreign_keys = ON
  ├─ BOOTSTRAP_SQL を実行
  │    └─ テーブル・インデックスを CREATE ... IF NOT EXISTS で作成
  ├─ migrateNoteDueColumns()
  │    └─ 旧バージョンの DB に due_at / reminder_at を ALTER TABLE で追加
  ├─ drizzle インスタンス生成
  │
  └─ migrateServerIds()
       └─ server_id が NULL のノートに UUID v4 を一括補完
```

### migrateNoteDueColumns()

`due_at` / `reminder_at` は後から追加されたカラムです。`BOOTSTRAP_SQL` の `CREATE TABLE IF NOT EXISTS` は既存テーブルには効かないため、`PRAGMA table_info('notes')` でカラムの有無を確認し、無ければ `ALTER TABLE` で追加します。drizzle インスタンスを生成する前に実行します。

### migrateServerIds()

`serverId` カラムは同期拡張のために後から追加されたため、既存ノートには `NULL` が入っている可能性があります。`migrateServerIds()` は起動時に実行され、`server_id IS NULL` のレコードを検出して 1 件ずつ UUID v4 を補完します（値がレコードごとに異なるため、単一の UPDATE 文にはできません）。件数分の UPDATE は 1 トランザクションにまとめてコミットします。

## テーブル定義

正となる定義は `src/data/db/schema.ts`（Drizzle 定義 + `BOOTSTRAP_SQL`）です。

### `notes`

メモの本体テーブルです。

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | INTEGER (PK) | AUTOINCREMENT |
| `title` | TEXT | メモのタイトル（空文字可） |
| `content` | TEXT | メモ本文（空文字可） |
| `type` | TEXT | `'TEXT'` / `'CHECKLIST'` |
| `color` | TEXT | `'NONE'`〜`'PURPLE'` の色名。実際の色値は `ui/theme/colors.ts` が持つ |
| `is_pinned` | INTEGER | ピン留め状態。1 = ピン留め / 0 = 通常 |
| `is_archived` | INTEGER | アーカイブ状態。1 = アーカイブ済み |
| `due_at` | INTEGER | 期限（Unix ミリ秒）。NULL = 期限なし |
| `reminder_at` | INTEGER | リマインド日時（Unix ミリ秒）。NULL の場合は `due_at` を使用 |
| `sort_weight` | REAL | 並び順の重み。`lib/sortWeight.ts` で計算 |
| `created_at` | INTEGER | 作成日時（Unix ミリ秒） |
| `updated_at` | INTEGER | 更新日時（Unix ミリ秒） |
| `deleted_at` | INTEGER | 論理削除日時（Unix ミリ秒）。NULL = 通常メモ |
| `server_id` | TEXT | サーバー同期用 UUID。将来の同期拡張に使用 |
| `synced_at` | INTEGER | 最終同期日時（Unix ミリ秒）。NULL = 未同期 |

### `checklist_items`

チェックリストアイテムのテーブルです。`notes` と 1 対多の関係です。

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | INTEGER (PK) | AUTOINCREMENT |
| `note_id` | INTEGER (FK) | 親ノートの `notes.id`（ON DELETE CASCADE） |
| `text` | TEXT | チェックアイテムのテキスト |
| `is_checked` | INTEGER | チェック状態。1 = チェック済み / 0 = 未チェック |
| `position` | INTEGER | 表示順序 |
| `created_at` | INTEGER | 作成日時（Unix ミリ秒） |
| `deleted_at` | INTEGER | 論理削除日時（Unix ミリ秒） |

### `labels`

ラベルのマスターテーブルです。

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | INTEGER (PK) | AUTOINCREMENT |
| `name` | TEXT | ラベル名。未削除のものは部分ユニークインデックスで重複不可 |
| `created_at` | INTEGER | 作成日時（Unix ミリ秒） |
| `updated_at` | INTEGER | 更新日時（Unix ミリ秒） |
| `deleted_at` | INTEGER | 論理削除日時（Unix ミリ秒） |

### `note_labels`（中間テーブル）

メモとラベルの多対多関係を管理します。

| カラム | 型 | 説明 |
|--------|-----|------|
| `note_id` | INTEGER (FK) | `notes.id`（ON DELETE CASCADE） |
| `label_id` | INTEGER (FK) | `labels.id`（ON DELETE CASCADE） |

複合主キー: `(note_id, label_id)`

### インデックス

| 名前 | 対象 |
|------|------|
| `idx_notes_updated_at` | `notes(updated_at DESC)` |
| `idx_notes_is_pinned` | `notes(is_pinned DESC, sort_weight DESC)` |
| `idx_checklist_note_id` | `checklist_items(note_id, position ASC)` |
| `idx_labels_name` | `labels(name) WHERE deleted_at IS NULL`（部分ユニーク） |
| `idx_note_labels_label_id` | `note_labels(label_id)` |

## 検索の実装

全文検索（FTS5）は未導入で、`DrizzleNoteRepository.search()` による `LIKE '%keyword%'` の部分一致検索です。検索対象は「タイトル」「本文」「チェックリストアイテムのテキスト」「ラベル名」です。

ユーザー入力は `lib/likePattern.ts` の `containsPattern()` でエスケープしてから埋め込み、`ESCAPE '\'` を付与します。これがないと `%` や `_` がワイルドカードとして解釈され、「100%」の検索が全件ヒットしてしまいます。

FTS5 自体は `app.json` の expo-sqlite プラグイン設定（`enableFTS: true`）でビルドに含めているため、将来的に仮想テーブルへ移行することは可能です。

## マイグレーション方針

### BOOTSTRAP_SQL（実際に実行される DDL）

テーブル・インデックスの DDL は `schema.ts` の `BOOTSTRAP_SQL` 定数に配列で保持し、`initDatabase()` が毎回 `IF NOT EXISTS` 付きで実行します。これにより冪等性が保たれます。既存テーブルへのカラム追加は `IF NOT EXISTS` では対応できないため、`client.ts` の `migrateNoteDueColumns()` のように個別の ALTER 処理を追加します。

```typescript
// src/data/db/schema.ts
export const BOOTSTRAP_SQL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS notes (...)`,
  `CREATE TABLE IF NOT EXISTS checklist_items (...)`,
  // ...
];
```

### Drizzle Kit による SQL 生成

スキーマ変更時は `src/data/db/schema.ts` を編集した後、以下で SQL ファイルを生成できます。

```bash
npm run generate
# drizzle-kit generate が実行され、
# src/data/db/migrations/ に SQL ファイルが追加されます
```

`src/data/db/migrations/` の SQL は現状アプリ実行時には読み込まれません（`migrate()` は呼んでいません）。スキーマ変更履歴の記録用であり、実行される DDL は `BOOTSTRAP_SQL` 側です。両者を必ず同時に更新してください。

## 論理削除と物理削除の使い分け

### 論理削除（ソフトデリート）

`deleted_at` カラムに削除日時を設定することで削除済みとして扱います。

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
| メモの削除 | 論理削除 | 誤削除の復元・将来のサーバー同期での tombstone 活用 |
| 完全削除 | 物理削除 | プライバシー配慮・ストレージ解放 |
| チェックリストアイテムの更新 | 論理削除 → 次回更新時に物理削除 | 保存のたびに全行を作り直すため、墓石行は 1 世代だけ残して物理削除する |
| ラベルの削除 | 論理削除 | 参照している `note_labels` を残したまま一覧から外す |
