/** Unix ms → 相対時刻文字列 (システムロケール依存) */
export function formatRelativeTime(date: Date): string {
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins  < 1)  return 'たった今';
  if (mins  < 60) return `${mins}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days  < 7)  return `${days}日前`;

  // システムロケールで日付表示 (ja-JP 固定ではなくデバイス設定に従う)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
