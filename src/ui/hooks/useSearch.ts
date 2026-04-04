import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note } from '@/domain/entities/Note';
import { getNoteRepository } from '@/lib/di';

export function useSearch() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  // 最後に発行したリクエストのシーケンス番号
  const seqRef = useRef(0);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const seq = ++seqRef.current; // このリクエストの番号を確保
    setLoading(true);

    try {
      const data = await getNoteRepository().search(q.trim());
      // 最新リクエスト以外の結果は捨てる
      if (seq === seqRef.current) {
        setResults(data);
      }
    } catch (e) {
      if (seq === seqRef.current) {
        setResults([]);
      }
      console.error(e);
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return { query, setQuery, results, loading };
}
