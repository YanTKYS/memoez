import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { Note } from '@/domain/entities/Note';
import type { Label } from '@/domain/entities/Label';
import { getNoteRepository, getLabelRepository } from '@/lib/di';
import { useNoteForm } from './useNoteForm';

export function useEditNote(noteId?: number) {
  const router = useRouter();

  const [note,      setNote]      = useState<Note | null>(null);
  const [loading,   setLoading]   = useState(!!noteId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [snackMsg,  setSnackMsg]  = useState('');

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
        setLoadError('メモを読み込めませんでした');
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
        // ★ update() の戻り値で note state を更新 → updatedAt 表示がリアルタイムに変わる
        const updated = await repo.update(note.id, {
          title:   form.title,
          content: form.content,
          type:    form.type,
          color:   form.color,
        });
        if (mountedRef.current) setNote(updated);

        if (form.type === 'CHECKLIST') {
          await repo.updateChecklistItems(note.id, items);
          // updateChecklistItems は notes.updatedAt も更新するので再取得
          const refreshed = await repo.findById(note.id);
          if (refreshed && mountedRef.current) setNote(refreshed);
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
          // updateChecklistItems は notes.updatedAt も更新するので再取得
          const refreshed = await repo.findById(created.id);
          if (refreshed && mountedRef.current) setNote(refreshed);
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

  // ─── 保存して戻る（stableBack 経由で BackHandler に渡す） ────────────────
  const handleBack = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!isEmpty()) await saveNote();
    router.back();
  }, [isEmpty, saveNote, router]);

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

  // ─── ラベル操作（LabelPickerSheet に props として渡す） ─────────────────
  const fetchLabels = useCallback((): Promise<Label[]> =>
    getLabelRepository().findAll(), []);

  const toggleNoteLabel = useCallback(async (labelId: number, attached: boolean): Promise<void> => {
    if (!note) return; // ★ non-null assertion を guard に変更
    const repo = getNoteRepository();
    if (attached) {
      await repo.detachLabel(note.id, labelId);
    } else {
      await repo.attachLabel(note.id, labelId);
    }
    await handleLabelChanged();
  }, [note, handleLabelChanged]);

  const createAndAttachLabel = useCallback(async (name: string): Promise<Label> => {
    if (!note) throw new Error('note is not saved yet'); // ★ guard に変更
    const label = await getLabelRepository().create(name);
    await getNoteRepository().attachLabel(note.id, label.id);
    await handleLabelChanged();
    return label;
  }, [note, handleLabelChanged]);

  // ─── 新規ノートの即時保存（ラベルシートを開く前に ID を確保する） ────────
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
    loadError,
    saving,
    snackMsg,
    setSnackMsg,
    ...noteForm,
    handleBack:          stableHandleBack,
    handleDelete,
    handlePin,
    handleLabelChanged,
    prepareForLabels,
    fetchLabels,
    toggleNoteLabel,
    createAndAttachLabel,
  };
}
