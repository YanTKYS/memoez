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

## バックアップ（ファイル / Google Drive）

バックアップ形式は JSON 1 種類のみで、保存先だけが異なります。Drive 専用の形式やテーブル直読みはありません。

```
SQLite
  │  INoteRepository
  ▼
exportBackupJson (domain/usecases/backupJson.ts)  ──►  JSON
                                                         ├─ ローカルファイル（BackupScreen）
                                                         └─ IRemoteBackupStore.upload
                                                              └─ GoogleDriveBackupStore (data/backup)
                                                                   └─ DriveClient (lib/googleDrive) ── Drive API / appDataFolder
復元: IRemoteBackupStore.download ─► importBackupJson（形式検証 → 書き込み。ファイル復元と同一処理）
```

- **domain/backup/**: `IRemoteBackupStore`（保存先の抽象）と `BackupError`（失敗の分類と利用者向け文言）。
- **domain/usecases/driveBackup.ts**: `backupToRemote` / `restoreFromRemote`。既存の export / import をつなぐだけ。
- **data/backup/GoogleDriveBackupStore.ts**: `memoez-backup.json` 1 ファイルの作成・上書き・取得。
- **lib/googleDrive/**: `googleAuth.ts`（Google Sign-In。ネイティブモジュールは初回利用時に遅延読み込みし、未設定ビルドでも他機能に影響しない）、`driveClient.ts`（fetch ベースの Drive v3 最小クライアント）、`config.ts`（Client ID・スコープ・ファイル名）。
- **ui/hooks/useGoogleDriveBackup.ts**: 接続状態・最終バックアップ日時・結果表示の状態管理。
- 要求スコープは `drive.appdata` のみ。セットアップは [google-drive-setup.md](google-drive-setup.md)。

## ホーム画面ウィジェット（v0.4.0）

メモを付箋としてホーム画面に表示し、タップするとホーム画面を背後に残したまま編集ウィンドウを開きます。オーバーレイ権限（`SYSTEM_ALERT_WINDOW`）は使わず、透過テーマの Activity で実現しています。

```
ホーム画面
  └─ NoteWidgetProvider（AppWidgetProvider）── WidgetStore（SharedPreferences）のスナップショットを描画
       │ タップ
       ▼
  FloatingEditorActivity / WidgetConfigActivity（透過・別タスクの ReactActivity。
       │   prebuild 時に config plugin がアプリ側へ生成し、ReactActivityDelegateWrapper で包む）
       │ 同じ ReactNativeHost ＝ 同じ JS ランタイム
       ▼
  index.ts で登録した "MemoEZWidgetWindow"（src/ui/widget/WidgetWindowRoot）
       ├─ 編集: FloatingNoteEditor → 既存の EditNoteScreen / useEditNote（presentation="floating"）
       └─ 配置時のメモ選択: WidgetNotePicker
```

### 構成

| 場所 | 内容 |
|------|------|
| `modules/memoez-widget/android/` | ローカル Expo モジュール（Kotlin）。Provider・ウィンドウの共通処理（`MemoEZWindowActivity` ほか）・テーマ・レイアウトを含み、Gradle のマニフェストマージでアプリへ取り込まれる |
| `modules/memoez-widget/plugin/` | config plugin（`app.json` の `plugins` に登録）。ウィンドウ用 Activity をアプリ側に生成し（`templates/`）、マニフェストに登録する。`android/` は生成物のままで、`expo prebuild --clean` のたびに同じ内容が作り直される |
| `src/ui/widget/` | ウィンドウのルート・カード表示（`FloatingWindow`）・編集・メモ選択 |
| `src/lib/widget/` | ネイティブモジュールの呼び出し（`widgetBridge`）、表示用スナップショット生成（`widgetSnapshot`）、同期（`widgetSync`） |
| `src/lib/noteChangeEvents.ts` | メモ変更の通知（同一 JS ランタイム内の pub/sub。150ms でまとめて配信） |
| `src/data/repositories/ChangeNotifyingNoteRepository.ts` | 書き込み成功後に変更を通知する `INoteRepository` のデコレータ（`di.ts` で常に適用） |

### データの流れ

- **正は SQLite のみ**。ウィジェットが描画する内容（タイトル・本文・チェックリスト・期限・配色）は、JS が既存の Repository で読み出した「表示用スナップショット」を `WidgetStore`（SharedPreferences）に保存したもの。プロセス終了・端末再起動後もランチャーの再描画要求にはここから応答する。
- ネイティブ側から SQLite を直接開かないのは、Android 標準の SQLite と expo-sqlite 同梱の SQLite が同じプロセスで同じ DB ファイルを開くと、POSIX ロックが互いに解除され DB 破損の原因になるため（[SQLite: How To Corrupt 2.2.1](https://www.sqlite.org/howtocorrupt.html)）。
- 更新契機: `getNoteRepository()` の書き込み（編集・ピン留め・削除・バックアップ復元などすべて）→ `notifyNotesChanged()` → `startWidgetSync()` がウィジェットに表示中のメモを読み直して `updateSnapshots`。内容が変わったウィジェットだけ描画し直す。アプリ／ウィンドウ起動時にも 1 回同期する。
- 削除されたメモ（`findById` が null）は「このメモは削除されました」表示になり、タップでメモを選び直せる。ウィジェットを削除すると対応とスナップショットを片付ける。

### 通常画面との共通化・競合対策

- `EditNoteScreen` / `useEditNote` / `LabelManagerScreen` から Expo Router への依存を外し、「閉じる」「ラベル管理を開く」を props で受け取る。通常画面（`app/note/*`, `app/labels.tsx`）は `router.back()` / `router.push()` を、ウィンドウはウィンドウを閉じる処理・重ね表示を渡す。編集 UI・自動保存・ラベル・カラー・期限・削除はすべて同じコード。
- `presentation="floating"` では Appbar のステータスバー余白とセーフエリア余白を付けない（ウィンドウ側で余白を取る）。
- 通常画面とウィンドウは同じ JS ランタイムで動くため、`useEditNote` は変更通知を受けると、未編集なら最新の内容を読み直す（入力中なら保持し、次の保存で後勝ち）。他方で削除されたら以後保存しない。読み直しは保存と同じ Promise チェーンに積み、自分の保存の途中経過を読まないようにしている。
- 自動保存の待ち時間中にアプリが裏に回った／画面が破棄された場合も、その時点の内容を保存する（通常画面の取りこぼし対策。ウィンドウの「閉じる」は下記のとおり保存完了を待つ）。
- `initDatabase()` は初期化結果を共有し、どちらが先に起動しても DB を開くのは 1 回だけ。

### タスク・ライフサイクル

- ウィンドウ用 Activity は Expo SDK 52 の MainActivity と同じく、デリゲートを `expo.modules.ReactActivityDelegateWrapper` で包み、Expo Modules（ReactActivityLifecycleListener / Handler）へライフサイクルを通知する。ラッパーは全 Expo モジュールに依存する `expo` パッケージにあり、ローカルモジュールからは依存が循環して参照できないため、config plugin がアプリ側にサブクラスを生成する（本体は `FloatingEditorActivityBase` / `WidgetConfigActivityBase`）。
- ウィジェットから開く Intent には data（URI）を付けない。expo-linking のライフサイクル通知がディープリンクとして扱い、同じ JS ランタイムの通常画面（Expo Router）に届くのを避けるため。
- ホーム・履歴ボタンで離れたとき（`onUserLeaveHint`）、編集中なら即座に破棄せず JS に `onCloseRequested` を送る。JS は戻る・× と同じ処理（保存完了 → ウィジェット同期 → `closeWindow()`）で閉じる。応答がなければ 5 秒後に閉じる。メモ選択・読み込み中など保存するものがない場合はそのまま閉じる。保存待ちの間に MemoEZ 本体が前面に来ても本体を閉じないよう、`closeWindow()` は開いているウィンドウ自身を記録して閉じる。
- Android（旧アーキテクチャ）ではアプリがバックグラウンドの間 JS のタイマーが止まるため、閉じる直前のウィジェット同期はタイマーを使わずに完了させてから閉じる（`exitWidgetWindow`）。

- ウィンドウ用 Activity は `taskAffinity="${applicationId}.widget"`・`excludeFromRecents`。MemoEZ 本体のタスクを前面に出さないため、背後はホーム画面のまま。ウィジェットからは `NEW_TASK | CLEAR_TASK` で開き、前回のウィンドウが残っていれば置き換える。
- 透過 Activity に画面向きを固定すると Android 8.0 で例外になるため、`screenOrientation` は指定しない。`configChanges` は MainActivity と揃え、テーマ切り替えで React Native の画面を作り直さない。
- キーボード表示時は `adjustResize` でウィンドウが縮み、カードもそれに合わせて縮む。

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
