import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Note } from '@/domain/entities/Note';
import { getNoteRepository } from '@/lib/di';
import { sortNotesByDueThenUpdated } from './noteDueSort';

interface UseNotesState {
  /** ピン留め → 通常 の順に並べた全件 */
  notes:        Note[];
  pinnedNotes:  Note[];
  regularNotes: Note[];
  loading:      boolean;
  error:        string | null;
  refresh:      () => Promise<void>;
}

export function useNotes(archived = false): UseNotesState {
  const [loaded,  setLoaded]  = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // `archived` はプリミティブなので deps に安全に入れられる
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLoaded(await getNoteRepository().findAll({ archived }));
    } catch (e) {
      setError('メモの読み込みに失敗しました');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [archived]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 表示順の決定はここに一本化する（画面側で並べ替え直さない）
  const pinnedNotes  = useMemo(() => sortNotesByDueThenUpdated(loaded.filter((n) => n.isPinned)),  [loaded]);
  const regularNotes = useMemo(() => sortNotesByDueThenUpdated(loaded.filter((n) => !n.isPinned)), [loaded]);
  const notes        = useMemo(() => [...pinnedNotes, ...regularNotes], [pinnedNotes, regularNotes]);

  return { notes, pinnedNotes, regularNotes, loading, error, refresh };
}
