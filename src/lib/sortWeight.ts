/** 新規メモの sort_weight: 既存最大値 + 1000 */
export function nextSortWeight(maxWeight: number): number {
  return maxWeight + 1000;
}

/** ドラッグ並び替え: a と b の間に挿入する値 */
export function midSortWeight(a: number, b: number): number {
  return (a + b) / 2;
}
