import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { Note } from '@/domain/entities/Note';
import { getNoteRepository } from '@/lib/di';
import { reminderScheduler } from '@/lib/reminderScheduler';
import { noteFormSnapshot, noteToForm, useNoteForm } from './useNoteForm';
import { useNoteLabelActions } from './useNoteLabelActions';

/** 入力が止まってから保存するまでの待ち時間 */
const AUTOSAVE_DELAY_MS = 1000;
/** 「保存しました」表示を消すまでの時間 */
const SAVED_FEEDBACK_MS = 3000;

export function useEditNote(noteId?: number) {
  const router = useRouter();

  const [note,        setNote]        = useState<Note | null>(null);
  const [loading,     setLoading]     = useState(!!noteId);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [snackMsg,    setSnackMsg]    = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const mountedRef        = useRef(true);
  const saveTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFeedbackRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef         = useRef(false);
  // 保存中に届いた変更を取りこぼさないためのフラグ
  const pendingSaveRef    = useRef(false);
  // 最後に永続化した内容。差分がなければ保存をスキップする
  const savedSnapshotRef  = useRef<string | null>(null);
  // ラベル付与のために自動生成した空メモかどうか
  const placeholderRef    = useRef(false);

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

  // ─── 既存ノート読み込み ──────────────────────────────────────────────────
  useEffect(() => {
    if (!noteId) return;
    getNoteRepository()
      .findById(noteId)
      .then((n) => {
        if (!mountedRef.current) return;
        if (n) {
          setNote(n);
          resetForm(n);
          savedSnapshotRef.current = noteFormSnapshot(noteToForm(n));
        }
        setLoading(false);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setLoadError('メモを読み込めませんでした');
        setLoading(false);
      });
  }, [noteId, resetForm]);

  // ─── 保存ロジック ────────────────────────────────────────────────────────
  // 常に最新の saveNote を指す ref（保存完了後の再実行に使う）
  const saveNoteRef = useRef<() => Promise<void>>(async () => {});

  const saveNote = useCallback(async (): Promise<void> => {
    // 保存中に呼ばれた分は破棄せず、完了後に再スケジュールする
    if (savingRef.current) { pendingSaveRef.current = true; return; }
    if (isEmpty())         return;

    const snapshot = noteFormSnapshot(form);
    if (snapshot === savedSnapshotRef.current) return; // 変更なし

    savingRef.current = true;
    if (mountedRef.current) setSaving(true);

    try {
      const repo  = getNoteRepository();
      const items = form.checklistItems
        .filter((i) => i.text.trim())
        .map((i, idx) => ({ text: i.text, isChecked: i.isChecked, position: idx * 1000 }));

      if (note) {
        const updated = await repo.update(note.id, {
          title:      form.title,
          content:    form.content,
          type:       form.type,
          color:      form.color,
          dueAt:      form.dueAt,
          reminderAt: form.reminderAt,
        });
        if (mountedRef.current) setNote(updated);
        reminderScheduler.syncNote(updated);

        if (form.type === 'CHECKLIST') {
          // updateChecklistItems が Note を返すので直接 state に反映（DB往復1回節約）
          const refreshed = await repo.updateChecklistItems(note.id, items);
          if (mountedRef.current) setNote(refreshed);
        }
      } else {
        const created = await repo.create({
          title:      form.title,
          content:    form.content,
          type:       form.type,
          color:      form.color,
          dueAt:      form.dueAt,
          reminderAt: form.reminderAt,
        });
        if (mountedRef.current) setNote(created);
        reminderScheduler.syncNote(created);

        if (form.type === 'CHECKLIST') {
          const refreshed = await repo.updateChecklistItems(created.id, items);
          if (mountedRef.current) setNote(refreshed);
        }
      }

      savedSnapshotRef.current = snapshot;
      placeholderRef.current = false;

      // 保存成功フィードバック
      if (mountedRef.current) {
        const now = new Date();
        setLastSavedAt(now);
        if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current);
        savedFeedbackRef.current = setTimeout(() => {
          if (mountedRef.current) setLastSavedAt(null);
        }, SAVED_FEEDBACK_MS);
      }
    } catch (e) {
      console.error('saveNote error:', e);
      if (mountedRef.current) setSnackMsg('保存に失敗しました');
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
      // 保存中に届いた変更を、最新の form を持つ saveNote で保存し直す
      if (pendingSaveRef.current && mountedRef.current) {
        pendingSaveRef.current = false;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          if (mountedRef.current) saveNoteRef.current();
        }, AUTOSAVE_DELAY_MS);
      }
    }
  }, [form, note, isEmpty]);

  saveNoteRef.current = saveNote;

  // ─── 自動保存 (debounce) ─────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (mountedRef.current) saveNote();
    }, AUTOSAVE_DELAY_MS);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [loading, saveNote]);

  // ─── 保存して戻る（stableBack 経由で BackHandler に渡す） ────────────────
  const handleBack = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!isEmpty()) {
      await saveNote();
    } else if (note && placeholderRef.current && note.labels.length === 0) {
      // ラベル選択のために自動生成した空メモを、一覧に残さず後始末する
      try {
        await getNoteRepository().delete(note.id);
      } catch (e) {
        console.error('discard placeholder note error:', e);
      }
    }
    router.back();
  }, [isEmpty, saveNote, note, router]);

  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;

  const stableHandleBack = useCallback(() => {
    handleBackRef.current();
  }, []);

  // ─── 削除 ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    Alert.alert('メモを削除', 'このメモを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          try {
            if (note) await getNoteRepository().delete(note.id);
            if (note) reminderScheduler.cancel(note.id);
            router.back();
          } catch (e) {
            console.error('delete note error:', e);
            if (mountedRef.current) setSnackMsg('削除に失敗しました');
          }
        },
      },
    ]);
  }, [note, router]);

  // ─── ピン留めトグル ──────────────────────────────────────────────────────
  const handlePin = useCallback(async () => {
    if (!note) return;
    const updated = await getNoteRepository().togglePin(note.id);
    if (mountedRef.current) setNote(updated);
  }, [note]);

  const markPlaceholder = useCallback(() => { placeholderRef.current = true; }, []);

  const { fetchLabels, toggleNoteLabel, prepareForLabels } = useNoteLabelActions({
    note,
    setNote,
    mountedRef,
    saveTimerRef,
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
    ...noteForm,
    handleBack:          stableHandleBack,
    handleDelete,
    handlePin,
    prepareForLabels,
    fetchLabels,
    toggleNoteLabel,
  };
}
