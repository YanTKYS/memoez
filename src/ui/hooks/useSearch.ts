import { useState, useEffect, useCallback } from 'react';
import type { Note } from '@/domain/entities/Note';
import { getNoteRepository } from '@/lib/di';

export function useSearch() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await getNoteRepository().search(q.trim());
      setResults(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return { query, setQuery, results, loading };
}
