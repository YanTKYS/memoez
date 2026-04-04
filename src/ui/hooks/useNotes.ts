import { useState, useEffect, useCallback } from 'react';
import type { Note } from '@/domain/entities/Note';
import { getNoteRepository } from '@/lib/di';

interface UseNotesState {
  notes:     Note[];
  loading:   boolean;
  error:     string | null;
  refresh:   () => Promise<void>;
}

export function useNotes(options: { archived?: boolean } = {}): UseNotesState {
  const [notes,   setNotes]   = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const repo  = getNoteRepository();
      const data  = await repo.findAll(options);
      setNotes(data);
    } catch (e) {
      setError('メモの読み込みに失敗しました');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [options.archived]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { notes, loading, error, refresh };
}
