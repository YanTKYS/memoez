import { useCallback, useEffect, useState } from 'react';
import { initDatabase } from '@/data/db/client';

export type DbState = 'loading' | 'ready' | 'error';

/**
 * DB の初期化状態。通常画面（app/_layout.tsx）とウィジェットのウィンドウで共用する。
 * initDatabase() は初期化結果を共有するため、どちらが先に呼んでも DB を開くのは 1 回だけ。
 */
export function useDatabaseInit() {
  const [dbState, setDbState] = useState<DbState>('loading');
  const [errMsg,  setErrMsg]  = useState('');

  const init = useCallback(() => {
    setDbState('loading');
    initDatabase()
      .then(() => setDbState('ready'))
      .catch((e: unknown) => {
        console.error('DB init failed:', e);
        setErrMsg(e instanceof Error ? e.message : String(e));
        setDbState('error');
      });
  }, []);

  useEffect(() => { init(); }, [init]);

  return { dbState, errMsg, retry: init };
}
