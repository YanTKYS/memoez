/** LIKE パターンのエスケープ文字。SQL 側の `ESCAPE '\'` と対で使う。 */
export const LIKE_ESCAPE_CHAR = '\\';

/**
 * ユーザー入力を LIKE パターンに埋め込めるようエスケープする。
 * `%` `_` はワイルドカードなので、そのまま渡すと「100%」の検索が全件ヒットしてしまう。
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `${LIKE_ESCAPE_CHAR}${ch}`);
}

/** 部分一致用の LIKE パターン (`%...%`) を組み立てる */
export function containsPattern(input: string): string {
  return `%${escapeLikePattern(input)}%`;
}
