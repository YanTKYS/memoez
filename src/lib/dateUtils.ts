/** Unix ms → 相対時刻文字列 */
export function formatRelativeTime(date: Date): string {
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins  < 1)  return 'たった今';
  if (mins  < 60) return `${mins}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days  < 7)  return `${days}日前`;

  // M/D 形式に固定（ロケール非依存）
  const month = date.getMonth() + 1;
  const day   = date.getDate();
  return `${month}/${day}`;
}
