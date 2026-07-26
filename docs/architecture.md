# アーキテクチャ概要

## レイヤー構成

MemoEZ はレイヤードアーキテクチャ + Repository パターンを採用しています。依存の向きは **上位レイヤーから下位レイヤーへの一方向** のみです。

```
┌─────────────────────────────────────────────────────────┐
│                        UI レイヤー                       │
│                                                         │
│  app/ (Expo Router)                                     │
│    ├── Screen コンポーネント (src/ui/screens/)           │
│    ├── hooks (src/ui/hooks/)                            │
│    └── components (src/ui/components/)                  │
│                                                         │
│  依存方向: hooks → IRepository インターフェース            │
└──────────────────────┬──────────────────────────────────┘
                       │ インターフェース経由
                       ▼
┌─────────────────────────────────────────────────────────┐
│                      DI エントリポイント                  │
│                   src/lib/di.ts                         │
│                                                         │
│  getNoteRepository() / getLabelRepository()             │
│  ※ コンクリートな依存を知るのはここだけ                    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                      data レイヤー                       │
│                                                         │
│  src/data/repositories/                                 │
│    ├── DrizzleNoteRepository                            │
│    └── DrizzleLabelRepository                           │
│                                                         │
│  src/data/db/                                           │
│    ├── schema.ts  (Drizzle スキーマ定義)                 │
│    └── client.ts  (DB 初期化・シングルトン)               │
│                                                         │
│  src/data/mappers/  (DB行 → ドメインエンティティ変換)     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                     domain レイヤー                      │
│                                                         │
│  src/domain/entities/                                   │
│    ├── Note                                             │
│    ├── Label                                            │
│    └── ChecklistItem                                    │
│                                                         │
│  src/domain/repositories/                               │
│    ├── INoteRepository                                  │
│    └── ILabelRepository                                 │
│                                                         │
│  ※ フレームワーク・DB への依存なし。純粋な TypeScript    │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  expo-sqlite / SQLite                    │
└─────────────────────────────────────────────────────────┘
```

## 各レイヤーの責務

### domain レイヤー (`src/domain/`)

- **entities/**: `Note`・`Label`・`ChecklistItem` の純粋な型定義とビジネスルール。React Native / Expo / Drizzle への依存を一切持たない。
- **repositories/**: `INoteRepository`・`ILabelRepository` インターフェース定義。data レイヤーに実装を強制するための抽象化。

### data レイヤー (`src/data/`)

- **db/schema.ts**: Drizzle のテーブル定義と `BOOTSTRAP_SQL`（起動時に冪等実行する DDL）。テーブル定義の唯一の真実。
- **db/client.ts**: SQLite DB の初期化・シングルトン管理。起動時に `migrateNoteDueColumns()` / `migrateServerIds()` を呼び出し、旧バージョンの DB への追従も行う。
- **repositories/**: `INoteRepository`・`ILabelRepository` の Drizzle 実装。SQL はすべてここに閉じる。
- **mappers/**: DB の行データ（snake_case）をドメインエンティティ（camelCase）に変換する純粋関数。

### UI レイヤー (`app/` + `src/ui/`)

- **screens/**: 各画面のルートコンポーネント。レイアウト・ナビゲーションの責務を持つ。
- **hooks/**: 画面のロジックを切り出したカスタムフック。`IRepository` インターフェース経由でデータ操作を行う。
- **components/**: 再利用可能な表示コンポーネント。副作用を持たず、props 駆動。
- **theme/**: React Native Paper の Material Design 3 テーマ定義・カラー・スペーシング。

### グローバルストア (`src/store/`)

- **settingsStore.ts**: Zustand による表示設定（一覧のグリッド / リスト切り替え）などの永続的なグローバル状態。AsyncStorage でデバイスに永続化。ダーク / ライトの配色は端末設定（`useColorScheme()`）に追従するため、ストアには持たない。

## DI の設計

```typescript
// src/lib/di.ts
import { DrizzleNoteRepository } from '../data/repositories/DrizzleNoteRepository';
import { DrizzleLabelRepository } from '../data/repositories/DrizzleLabelRepository';
import { getDb } from '../data/db/client';

export function getNoteRepository(): INoteRepository {
  return new DrizzleNoteRepository(getDb());
}

export function getLabelRepository(): ILabelRepository {
  return new DrizzleLabelRepository(getDb());
}
```

- **DI はシンプルな関数ファクトリ**として実装。DI コンテナは使用しない。
- コンクリートな依存（`DrizzleNoteRepository` 等）を知るのは `di.ts` だけ。
- hooks は `di.ts` の関数を呼び出してリポジトリを取得し、インターフェース型として扱う。
- テスト時はモックリポジトリを直接渡すことで hooks 単体のテストが可能。

## データフロー

```
画面 (Screen)
  │  props / コールバック
  ▼
カスタムフック (useEditNote 等)
  │  INoteRepository を呼び出し
  ▼
DI エントリポイント (di.ts)
  │  DrizzleNoteRepository を返す
  ▼
Repository 実装 (DrizzleNoteRepository)
  │  Drizzle ORM でクエリ組み立て
  ▼
expo-sqlite (SQLite)
  │  結果行を返す
  ▼
mapper (DB行 → Note エンティティ)
  │
  ▼
hooks が状態を更新 → Screen が再描画
```

## 楽観的更新パターン

ラベルのトグルなど即時反応が求められる操作では、**UI 先行更新 → 非同期 DB 書き込み → エラー時にスナップショット復元** というパターンを採用しています。

```typescript
// hooks/useEditNote.ts（概略）
const toggleLabel = useCallback(async (labelId: string) => {
  // 1. 現在の状態をスナップショットとして保存
  const snapshot = currentLabels;

  // 2. UI を先行更新（即時反映）
  setCurrentLabels(optimisticLabels);

  try {
    // 3. DB に非同期で書き込み
    await noteRepository.toggleLabel(noteId, labelId);
  } catch (e) {
    // 4. エラー時はスナップショットに巻き戻し
    setCurrentLabels(snapshot);
    showErrorToast();
  }
}, [currentLabels, noteId, noteRepository]);
```

この方式により、ネットワーク遅延のないローカル DB であっても操作レスポンスが一定に保たれ、将来のサーバー同期時にも同パターンが適用可能です。

## 将来の同期拡張ポイント

現時点でオフライン専用ですが、以下の設計により最小限の変更でサーバー同期を追加できます。

| 拡張ポイント | 内容 |
|------------|------|
| `INoteRepository` のスタブコメント | `fetchRemote()` / `pushChanges()` メソッド追加を想定したコメントが記載済み |
| `notes.server_id` カラム | UUID v4 を `serverId` として保持。サーバー側 ID との突き合わせに使用 |
| `notes.synced_at` カラム | 最終同期日時。差分取得クエリ（`WHERE updated_at > synced_at`）に使用 |
| `migrateServerIds()` | 既存ノートへの `serverId` 補完。同期機能追加前からのデータを安全に移行 |
| 楽観的更新パターン | サーバーへの書き込みが失敗した場合のロールバック機構が既に実装済み |

同期機能を追加する場合は、`INoteRepository` に同期メソッドを追加し、`DrizzleNoteRepository` または新しい `SyncedNoteRepository` に実装することで UI レイヤーへの変更を最小化できます。
