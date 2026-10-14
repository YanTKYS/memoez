import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
import type { Note } from '@/domain/entities/Note';
import { getNoteRepository } from '@/lib/di';
import { subscribeNotesChanged } from '@/lib/noteChangeEvents';
import { reminderScheduler } from '@/lib/reminderScheduler';
import { checklistItemsToSave, noteFormSnapshot, noteToForm, useNoteForm } from './useNoteForm';
import { useNoteLabelActions } from './useNoteLabelActions';

/** 入力が止まってから保存するまでの待ち時間 */
const AUTOSAVE_DELAY_MS = 1000;
/** 「保存しました」表示を消すまでの時間 */
const SAVED_FEEDBACK_MS = 3000;

export interface UseEditNoteOptions {
  /**
   * 編集を終えて画面を閉じる（保存完了後に呼ばれる）。
   * 通常画面では router.back()、ウィジェットのフローティングエディタではウィンドウを閉じる。
   */
  onExit: () => void;
}

export function useEditNote(noteId: number | undefined, { onExit }: UseEditNoteOptions) {
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  const [note,        setNote]        = useState<Note | null>(null);
  const [loading,     setLoading]     = useState(!!noteId);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [snackMsg,    setSnackMsg]    = useState('');
  // 直近の保存に失敗し、画面の入力内容がまだ保存されていない
  const [saveError,   setSaveError]   = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const mountedRef       = useRef(true);
  const savedFeedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 保存中のノート。保存処理は再レンダリングを待たずに最新値を参照する必要がある
  const noteRef          = useRef<Note | null>(null);
  // 最後に永続化した内容。差分がなければ保存をスキップする
  const savedSnapshotRef = useRef<string | null>(null);
  // ラベル付与のために自動生成した空メモかどうか
  const placeholderRef   = useRef(false);
  // 画面を離れた／メモを削除した後に自動保存が走らないようにするフラグ
  const closedRef        = useRef(false);
  // 戻る操作の受付済みフラグ（保存待ちの間に連打されても二重に戻らないようにする）
  const leavingRef       = useRef(false);

  useEffect(() => {
    // StrictMode / Fast Refresh で effect が再実行されても
    // マウント済みとして扱えるよう、毎回 true に戻す
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current);
    };
  }, []);

  const noteForm = useNoteForm();
  const { form, resetForm, isEmpty } = noteForm;
  // 非同期処理の途中で最新の入力内容を参照するための ref
  const formRef = useRef(form);
  formRef.current = form;

  /** note の state と ref をまとめて更新する */
  const applyNote = useCallback((next: Note | null) => {
    noteRef.current = next;
    if (mountedRef.current) setNote(next);
  }, []);

  const getNote = useCallback(() => noteRef.current, []);

  // ─── 既存ノート読み込み ──────────────────────────────────────────────────
  useEffect(() => {
    if (!noteId) return;
    getNoteRepository()
      .findById(noteId)
      .then((loaded) => {
        if (!mountedRef.current) return;
        if (!loaded) {
          // 削除済みのメモを古い一覧から開いたケース。新規メモ扱いにすると
          // 編集内容が別のメモとして作られてしまうため、エラーとして扱う。
          closedRef.current = true;
          setLoadError('メモが見つかりませんでした');
        } else {
          applyNote(loaded);
          resetForm(loaded);
          savedSnapshotRef.current = noteFormSnapshot(noteToForm(loaded));
        }
        setLoading(false);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        closedRef.current = true;
        setLoadError('メモを読み込めませんでした');
        setLoading(false);
      });
  }, [noteId, resetForm, applyNote]);

  // ─── 保存ロジック ────────────────────────────────────────────────────────
  const showSavedFeedback = useCallback(() => {
    if (!mountedRef.current) return;
    setLastSavedAt(new Date());
    if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current);
    savedFeedbackRef.current = setTimeout(() => {
      if (mountedRef.current) setLastSavedAt(null);
    }, SAVED_FEEDBACK_MS);
  }, []);

  /**
   * 現在のフォーム内容を 1 回だけ永続化する。
   * 保存できた（または保存するものがない）なら true、保存に失敗したら false。
   */
  const persist = useCallback(async (): Promise<boolean> => {
    if (closedRef.current) return true;

    const current = noteRef.current;
    // 空のまま新規作成はしない。既存メモは空にした状態も保存する（本文を消せるように）
    if (!current && isEmpty()) return true;

    const snapshot = noteFormSnapshot(form);
    if (snapshot === savedSnapshotRef.current) return true; // 変更なし

    if (mountedRef.current) setSaving(true);
    try {
      const repo  = getNoteRepository();
      const input = {
        title:      form.title,
        content:    form.content,
        type:       form.type,
        color:      form.color,
        dueAt:      form.dueAt,
        reminderAt: form.reminderAt,
      };

      const saved = current
        ? await repo.update(current.id, input)
        : await repo.create(input);
      applyNote(saved);
      reminderScheduler.syncNote(saved);

      // TEXT に切り替えたメモは、DB に残っているチェックリスト行も消す
      const items = checklistItemsToSave(form);
      if (items.length > 0 || saved.checklistItems.length > 0) {
        applyNote(await repo.updateChecklistItems(saved.id, items));
      }

      savedSnapshotRef.current = snapshot;
      placeholderRef.current   = false;
      if (mountedRef.current) setSaveError(false);
      showSavedFeedback();
      return true;
    } catch (e) {
      console.error('saveNote error:', e);
      if (mountedRef.current) setSaveError(true);
      return false;
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [form, isEmpty, applyNote, showSavedFeedback]);

  /**
   * 保存を 1 本のチェーンに直列化する。
   * 「保存中に来た変更の取りこぼし」も「同じメモの二重作成」もこれで防げる。
   * 戻り値（true = 保存済み）を await すれば、その時点のフォーム内容が書き込まれたかが分かる。
   */
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());

  const saveNote = useCallback((): Promise<boolean> => {
    const next = saveChainRef.current.then(persist);
    saveChainRef.current = next.catch(() => {});
    return next;
  }, [persist]);

  // ─── 自動保存 (debounce) ─────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => { saveNote(); }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading, saveNote]);

  // ─── 待ち時間中の入力を取りこぼさない ────────────────────────────────────
  // debounce の待ち時間中にアプリが裏に回る・画面が破棄される（ウィジェットの
  // フローティングエディタはホームボタンで閉じる）と、最後の入力が保存されない。
  // その時点の内容を即座に保存する。保存済み・削除済みなら persist 側で何もしない。
  const saveNoteRef = useRef(saveNote);
  saveNoteRef.current = saveNote;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') saveNoteRef.current().catch(() => {});
    });
    return () => {
      sub.remove();
      saveNoteRef.current().catch(() => {});
    };
  }, []);

  // ─── 他の画面での変更を反映 ──────────────────────────────────────────────
  // 通常画面とウィジェットのフローティングエディタで同じメモを開いている場合に、
  // 古い内容のまま上書き保存しないよう、未編集なら最新の内容を読み直す。
  // 保存と同じチェーンに積むので、自分の保存の途中経過を読み込むことはない。
  const reloadIfChangedElsewhere = useCallback(async (): Promise<void> => {
    const current = noteRef.current;
    if (!current || closedRef.current || leavingRef.current) return;

    const latest = await getNoteRepository().findById(current.id);
    if (closedRef.current || !mountedRef.current) return;

    if (!latest) {
      // 別の画面で削除された。以後の自動保存で復活させない
      closedRef.current = true;
      setLoadError('このメモは削除されました');
      return;
    }

    // 入力中の内容があれば保持する（次の自動保存で上書き＝後勝ち）
    if (noteFormSnapshot(formRef.current) !== savedSnapshotRef.current) return;

    applyNote(latest);
    const latestSnapshot = noteFormSnapshot(noteToForm(latest));
    if (latestSnapshot !== savedSnapshotRef.current) {
      resetForm(latest);
      savedSnapshotRef.current = latestSnapshot;
    }
  }, [applyNote, resetForm]);

  const reloadRef = useRef(reloadIfChangedElsewhere);
  reloadRef.current = reloadIfChangedElsewhere;

  useEffect(() => subscribeNotesChanged(() => {
    saveChainRef.current = saveChainRef.current
      .then(() => reloadRef.current())
      .catch((e) => console.error('reload note error:', e));
  }), []);

  // ─── 保存して戻る（stableBack 経由で BackHandler に渡す） ────────────────
  /**
   * 保存が完了してから画面を閉じる。閉じたら true。
   * 保存に失敗した場合は閉じずに入力内容を残し（saveError で通知）、false を返す。
   */
  const handleBack = useCallback(async (): Promise<boolean> => {
    if (leavingRef.current) return false; // 保存を待っている間の連打を無視する
    leavingRef.current = true;

    const current = noteRef.current;
    if (isEmpty() && current && placeholderRef.current && current.labels.length === 0) {
      // ラベル選択のために自動生成した空メモを、一覧に残さず後始末する
      closedRef.current = true;
      try {
        await getNoteRepository().delete(current.id);
      } catch (e) {
        console.error('discard placeholder note error:', e);
      }
    } else {
      if (!(await saveNote())) {
        // 保存できていない内容を捨てて閉じない（もう一度閉じれば再試行する）
        leavingRef.current = false;
        return false;
      }
      closedRef.current = true;
    }
    onExitRef.current();
    return true;
  }, [isEmpty, saveNote]);

  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;

  const stableHandleBack = useCallback((): Promise<boolean> => handleBackRef.current(), []);

  /** 保存に失敗し続ける場合の逃げ道。未保存の変更を捨てて閉じる（利用者が明示的に選んだときだけ） */
  const discardChangesAndExit = useCallback(() => {
    closedRef.current = true;
    setSaveError(false);
    onExitRef.current();
  }, []);

  // ─── 削除 ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    const target = noteRef.current;
    if (!target) return;
    Alert.alert('メモを削除', 'このメモを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          closedRef.current = true; // 削除後に自動保存で復活させない
          try {
            await getNoteRepository().delete(target.id);
            reminderScheduler.cancel(target.id);
            onExitRef.current();
          } catch (e) {
            console.error('delete note error:', e);
            closedRef.current = false;
            if (mountedRef.current) setSnackMsg('削除に失敗しました');
          }
        },
      },
    ]);
  }, []);

  // ─── ピン留めトグル ──────────────────────────────────────────────────────
  const handlePin = useCallback(async () => {
    const target = noteRef.current;
    if (!target) return;
    try {
      applyNote(await getNoteRepository().togglePin(target.id));
    } catch (e) {
      console.error('togglePin error:', e);
      if (mountedRef.current) setSnackMsg('ピン留めを変更できませんでした');
    }
  }, [applyNote]);

  const markPlaceholder = useCallback(() => { placeholderRef.current = true; }, []);

  const { fetchLabels, toggleNoteLabel, prepareForLabels } = useNoteLabelActions({
    getNote,
    setNote: applyNote,
    mountedRef,
    isEmpty,
    saveNote,
    formType: form.type,
    formColor: form.color,
    onPlaceholderCreated: markPlaceholder,
  });

  return {
    note,
    loading,
    loadError,
    saving,
    lastSavedAt,
    snackMsg,
    setSnackMsg,
    saveError,
    ...noteForm,
    handleBack:          stableHandleBack,
    discardChangesAndExit,
    handleDelete,
    handlePin,
    prepareForLabels,
    fetchLabels,
    toggleNoteLabel,
  };
}
