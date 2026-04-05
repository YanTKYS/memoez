import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { Note } from '@/domain/entities/Note';
import { getNoteRepository } from '@/lib/di';
import { useNoteForm } from './useNoteForm';

export function useEditNote(noteId?: number) {
  const router = useRouter();

  const [note,     setNote]     = useState<Note | null>(null);
  const [loading,  setLoading]  = useState(!!noteId);
  const [saving,   setSaving]   = useState(false);
  const [snackMsg, setSnackMsg] = useState('');

  const mountedRef   = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef    = useRef(false);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const noteForm = useNoteForm();
  const { form, resetForm, isEmpty } = noteForm;

  // ─── 既存ノート読み込み ──────────────────────────────────────────────────
  useEffect(() => {
    if (!noteId) return;
    getNoteRepository()
      .findById(noteId)
      .then((n) => {
        if (!mountedRef.current) return;
        if (n) { setNote(n); resetForm(n); }
        setLoading(false);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setLoading(false);
      });
  }, [noteId]); // resetForm は安定した useCallback なので deps 省略安全

  // ─── 保存ロジック ────────────────────────────────────────────────────────
  const saveNote = useCallback(async (): Promise<void> => {
    if (savingRef.current) return;
    if (isEmpty())         return;

    savingRef.current = true;
    if (mountedRef.current) setSaving(true);

    try {
      const repo  = getNoteRepository();
      const items = form.checklistItems
        .filter((i) => i.text.trim())
        .map((i, idx) => ({ text: i.text, isChecked: i.isChecked, position: idx * 1000 }));

      if (note) {
        await repo.update(note.id, {
          title:   form.title,
          content: form.content,
          type:    form.type,
          color:   form.color,
        });
        if (form.type === 'CHECKLIST') {
          await repo.updateChecklistItems(note.id, items);
        }
      } else {
        const created = await repo.create({
          title:   form.title,
          content: form.content,
          type:    form.type,
          color:   form.color,
        });
        if (mountedRef.current) setNote(created);
        if (form.type === 'CHECKLIST') {
          await repo.updateChecklistItems(created.id, items);
        }
      }
    } catch (e) {
      console.error('saveNote error:', e);
      if (mountedRef.current) setSnackMsg('保存に失敗しました');
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [form, note, isEmpty]);

  // ─── 自動保存 (debounce 1秒) ─────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (mountedRef.current) saveNote();
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [loading, saveNote]);

  // ─── 保存して戻る ────────────────────────────────────────────────────────
  const handleBack = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!isEmpty()) await saveNote();
    router.back();
  }, [isEmpty, saveNote, router]);

  // ─── 削除 ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    Alert.alert('メモを削除', 'このメモを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          if (note) await getNoteRepository().delete(note.id);
          router.back();
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

  // ─── ラベル変更後の反映 ──────────────────────────────────────────────────
  const handleLabelChanged = useCallback(async () => {
    if (!note) return;
    const updated = await getNoteRepository().findById(note.id);
    if (updated && mountedRef.current) setNote(updated);
  }, [note]);

  // ─── 新規ノートの即時保存（ラベルシートを開く前に ID を確保する） ────────
  // 呼び出し元は onOpen() が実行されたとき setShowLabels(true) を行う
  const prepareForLabels = useCallback(async (): Promise<boolean> => {
    if (!note && !isEmpty()) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      await saveNote();
    }
    return mountedRef.current;
  }, [note, isEmpty, saveNote]);

  return {
    note,
    loading,
    saving,
    snackMsg,
    setSnackMsg,
    ...noteForm,
    handleBack,
    handleDelete,
    handlePin,
    handleLabelChanged,
    prepareForLabels,
  };
}
