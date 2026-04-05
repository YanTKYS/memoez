import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { Note } from '@/domain/entities/Note';
import type { Label } from '@/domain/entities/Label';
import { getNoteRepository, getLabelRepository } from '@/lib/di';
import { useNoteForm } from './useNoteForm';

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

  useEffect(() => () => {
    mountedRef.current = false;
    if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current);
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
        const updated = await repo.update(note.id, {
          title:   form.title,
          content: form.content,
          type:    form.type,
          color:   form.color,
        });
        if (mountedRef.current) setNote(updated);

        if (form.type === 'CHECKLIST') {
          // updateChecklistItems が Note を返すので直接 state に反映（DB往復1回節約）
          const refreshed = await repo.updateChecklistItems(note.id, items);
          if (mountedRef.current) setNote(refreshed);
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
          const refreshed = await repo.updateChecklistItems(created.id, items);
          if (mountedRef.current) setNote(refreshed);
        }
      }

      // 保存成功フィードバック（3秒後にクリア）
      if (mountedRef.current) {
        const now = new Date();
        setLastSavedAt(now);
        if (savedFeedbackRef.current) clearTimeout(savedFeedbackRef.current);
        savedFeedbackRef.current = setTimeout(() => {
          if (mountedRef.current) setLastSavedAt(null);
        }, 3000);
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

  // ─── ラベル操作（楽観的更新 → findById 不要） ────────────────────────────
  const fetchLabels = useCallback((): Promise<Label[]> =>
    getLabelRepository().findAll(), []);

  const toggleNoteLabel = useCallback(async (label: Label, attached: boolean): Promise<void> => {
    if (!note) return;
    const prevLabels = note.labels;
    // 楽観的に UI を更新
    const newLabels = attached
      ? note.labels.filter(l => l.id !== label.id)
      : [...note.labels, label];
    if (mountedRef.current) setNote({ ...note, labels: newLabels });
    const repo = getNoteRepository();
    try {
      if (attached) await repo.detachLabel(note.id, label.id);
      else          await repo.attachLabel(note.id, label.id);
    } catch (e) {
      // DB失敗時ロールバック
      if (mountedRef.current) setNote({ ...note, labels: prevLabels });
      throw e; // LabelPickerSheet の errMsg 表示に伝播
    }
  }, [note]);

  const createAndAttachLabel = useCallback(async (name: string): Promise<Label> => {
    if (!note) throw new Error('note is not saved yet');
    const label = await getLabelRepository().create(name);
    await getNoteRepository().attachLabel(note.id, label.id);
    // 楽観的に labels に追加
    if (mountedRef.current) {
      setNote(prev => prev ? { ...prev, labels: [...prev.labels, label] } : prev);
    }
    return label;
  }, [note]);

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
    createAndAttachLabel,
  };
}
