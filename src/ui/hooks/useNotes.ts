import { useState, useEffect, useCallback } from 'react';
import type { Note } from '@/domain/entities/Note';
import { getNoteRepository } from '@/lib/di';

interface UseNotesState {
  notes:   Note[];
  loading: boolean;
  error:   string | null;
  refresh: () => Promise<void>;
}

export function useNotes(archived = false): UseNotesState {
  const [notes,   setNotes]   = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // `archived` はプリミティブなので deps に安全に入れられる
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNoteRepository().findAll({ archived });
      setNotes(data);
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

  return { notes, loading, error, refresh };
}
