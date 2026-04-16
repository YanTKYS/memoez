import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note } from '@/domain/entities/Note';
import { getNoteRepository } from '@/lib/di';

function matchesQuery(note: Note, q: string): boolean {
  const lower = q.toLowerCase();
  if (note.title.toLowerCase().includes(lower)) return true;
  if (note.content.toLowerCase().includes(lower)) return true;
  if (note.labels.some((l) => l.name.toLowerCase().includes(lower))) return true;
  return note.checklistItems.some((item) => item.text.toLowerCase().includes(lower));
}

export function useSearch(selectedLabelId: number | null = null) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  // 最後に発行したリクエストのシーケンス番号
  const seqRef = useRef(0);

  const search = useCallback(async (q: string) => {
    const keyword = q.trim();
    if (!keyword && selectedLabelId === null) {
      setResults([]);
      setLoading(false);
      return;
    }

    const seq = ++seqRef.current; // このリクエストの番号を確保
    setLoading(true);

    try {
      let data: Note[];
      if (selectedLabelId !== null) {
        const byLabel = await getNoteRepository().findByLabel(selectedLabelId);
        data = keyword ? byLabel.filter((n) => matchesQuery(n, keyword)) : byLabel;
      } else {
        data = await getNoteRepository().search(keyword);
      }
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
  }, [selectedLabelId]);

  // debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, selectedLabelId, search]);

  return { query, setQuery, results, loading };
}
