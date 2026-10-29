import type { UpdateCheck } from './updatesBridge';

const messages: Record<string, string> = {
  unavailable: '更新機能には Android のアプリビルドが必要です。',
  cancelled: '更新の取得を中断しました。',
  storage: '更新ファイルを保存する空き容量が足りません。',
  network: '通信できませんでした。接続を確認して再度お試しください。',
  timeout: '通信がタイムアウトしました。再度お試しください。',
  rate_limit: 'GitHub の利用制限に達しました。時間をおいて再度お試しください。',
  missing_assets: '対応する正式署名 APK がありません。',
  invalid_metadata: '更新情報が正しくないため、更新できません。',
  size_limit: '更新ファイルのサイズが対応範囲を超えています。',
  incomplete: '更新ファイルを最後まで取得できませんでした。',
  checksum: '更新ファイルの検証に失敗しました。',
  signature: 'インストール済みアプリと署名が異なるため、更新できません。',
  package: 'MemoEZ 用の更新ファイルではありません。',
  older: 'インストール済みの版より新しくないため、更新しません。',
  debug_build: 'デバッグ版はアプリ内更新の対象外です。',
  permission: 'この提供元からのアプリのインストールを許可してください。',
  activity: '更新画面を開けませんでした。もう一度お試しください。',
  installer_unavailable: 'Android のインストーラーを開けませんでした。',
  installer_open: 'Android のインストーラーで操作を完了してから再確認してください。',
  check_required: '最新版を確認し、更新ファイルを再取得してください。',
  busy: '処理が完了するまでお待ちください。',
  unsafe_url: '安全な配布先を確認できないため、取得を中止しました。',
  legacy: 'このリリースはアプリ内更新の対象外です。対応する正式署名 APK がありません。',
};
export function updateError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  return messages[code] ?? '安全に更新できることを確認できませんでした。Release ページをご確認ください。';
}
export function updateStatus(check: UpdateCheck): string {
  if (check.status === 'available') return '新しい版を利用できます。';
  if (check.status === 'current') return '最新の版がインストールされています。';
  if (check.status === 'older') return messages.older;
  if (check.status === 'none') return '正式リリースはまだ公開されていません。';
  return messages[check.reason ?? 'invalid_metadata'] ?? messages.invalid_metadata;
}
