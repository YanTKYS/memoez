import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note } from '@/domain/entities/Note';
import { getNoteRepository } from '@/lib/di';
import { buildSearchPlan, noteMatchesKeyword } from './searchQueryPlan';

export function useSearch(selectedLabelId: number | null = null) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  // 最後に発行したリクエストのシーケンス番号
  const seqRef = useRef(0);

  const search = useCallback(async (q: string) => {
    const plan = buildSearchPlan(q, selectedLabelId);
    if (plan.mode === 'none') {
      setResults([]);
      setLoading(false);
      return;
    }

    const seq = ++seqRef.current; // このリクエストの番号を確保
    setLoading(true);

    try {
      let data: Note[];
      switch (plan.mode) {
        case 'label': {
          data = await getNoteRepository().findByLabel(plan.selectedLabelId!);
          break;
        }
        case 'label+keyword': {
          const byLabel = await getNoteRepository().findByLabel(plan.selectedLabelId!);
          data = byLabel.filter((n) => noteMatchesKeyword(n, plan.keyword));
          break;
        }
        case 'keyword': {
          data = await getNoteRepository().search(plan.keyword);
          break;
        }
        default: {
          data = [];
        }
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
