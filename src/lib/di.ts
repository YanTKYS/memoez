/**
 * 依存性注入の唯一のエントリポイント。
 * 具体的な Repository クラスを知るのはここだけ。
 * テスト時はこのファイルをモックに差し替える。
 */
import { getDb } from '@/data/db/client';
import { DrizzleNoteRepository } from '@/data/repositories/DrizzleNoteRepository';
import { DrizzleLabelRepository } from '@/data/repositories/DrizzleLabelRepository';

export function getNoteRepository(): DrizzleNoteRepository {
  return new DrizzleNoteRepository(getDb());
}

export function getLabelRepository(): DrizzleLabelRepository {
  return new DrizzleLabelRepository(getDb());
}
