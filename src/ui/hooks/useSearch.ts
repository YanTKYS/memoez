import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note } from '@/domain/entities/Note';
import { getNoteRepository } from '@/lib/di';
import { buildSearchPlan, noteMatchesKeyword } from './searchQueryPlan';

/** 入力が止まってから検索するまでの待ち時間 */
const SEARCH_DEBOUNCE_MS = 300;

export function useSearch(selectedLabelId: number | null = null) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  // 最後に発行したリクエストのシーケンス番号
  const seqRef = useRef(0);

  const search = useCallback(async (q: string) => {
    const plan = buildSearchPlan(q, selectedLabelId);
    const seq = ++seqRef.current; // このリクエストの番号を確保

    // 条件クリア時も採番することで、実行中の検索結果が後から流れ込むのを防ぐ
    if (plan.mode === 'none') {
      setResults([]);
      setLoading(false);
      return;
    }

    try {
      const repo = getNoteRepository();
      let data: Note[];
      switch (plan.mode) {
        case 'label':
          data = await repo.findByLabel(plan.selectedLabelId!);
          break;
        case 'label+keyword': {
          const byLabel = await repo.findByLabel(plan.selectedLabelId!);
          data = byLabel.filter((n) => noteMatchesKeyword(n, plan.keyword));
          break;
        }
        default:
          data = await repo.search(plan.keyword);
      }
      // 最新リクエスト以外の結果は捨てる
      if (seq === seqRef.current) setResults(data);
    } catch (e) {
      console.error(e);
      if (seq === seqRef.current) setResults([]);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [selectedLabelId]);

  useEffect(() => {
    // 待機中も loading にしておく。
    // そうしないと入力直後に「見つかりませんでした」が一瞬表示されてしまう。
    setLoading(buildSearchPlan(query, selectedLabelId).mode !== 'none');
    const timer = setTimeout(() => search(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, selectedLabelId, search]);

  return { query, setQuery, results, loading };
}
