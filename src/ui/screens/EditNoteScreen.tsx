import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import {
  Appbar,
  Text,
  IconButton,
  Divider,
  ActivityIndicator,
  Snackbar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Note } from '@/domain/entities/Note';
import { NOTE_COLOR_LIGHT } from '@/ui/theme/colors';
import { spacing } from '@/ui/theme/spacing';
import { getNoteRepository } from '@/lib/di';
import { useNoteForm } from '@/ui/hooks/useNoteForm';
import { ColorPicker } from '@/ui/components/common/ColorPicker';
import { LabelPickerSheet } from '@/ui/components/common/LabelPickerSheet';
import { formatRelativeTime } from '@/lib/dateUtils';

interface Props {
  noteId?: number;
}

export function EditNoteScreen({ noteId }: Props) {
  const router   = useRouter();
  const [note,        setNote]        = useState<Note | null>(null);
  const [loadingNote, setLoadingNote] = useState(!!noteId);
  const [saving,      setSaving]      = useState(false);
  const [showColor,   setShowColor]   = useState(false);
  const [showLabels,  setShowLabels]  = useState(false);
  const [snackMsg,    setSnackMsg]    = useState('');

  const mountedRef   = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef    = useRef(false);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const {
    form,
    setTitle, setContent, setType, setColor,
    addChecklistItem, updateChecklistItem,
    toggleChecklistItem, removeChecklistItem,
    resetForm, isEmpty,
  } = useNoteForm();

  // ─── 既存ノート読み込み ──────────────────────────────────────────────────
  useEffect(() => {
    if (!noteId) return;
    getNoteRepository()
      .findById(noteId)
      .then((n) => {
        if (!mountedRef.current) return;
        if (n) {
          setNote(n);
          // ★ フォームをロード済みデータで初期化 (Critical fix)
          resetForm(n);
        }
        setLoadingNote(false);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setLoadingNote(false);
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
    if (loadingNote) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (mountedRef.current) saveNote();
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [loadingNote, saveNote]);

  // ─── 保存して戻る ────────────────────────────────────────────────────────
  const handleBack = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!isEmpty()) await saveNote();
    router.back();
  }, [isEmpty, saveNote, router]);

  // ─── Android ハードウェアバックボタン ─────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true; // デフォルト動作を抑制
    });
    return () => sub.remove();
  }, [handleBack]);

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

  // ─── 新規ノートの即時保存（ラベルボタンを有効にするため） ───────────────
  // note が null のまま ラベルボタンを押したとき、先に保存してから Sheet を開く
  const handleLabelPress = useCallback(async () => {
    if (!note && !isEmpty()) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      await saveNote();
    }
    if (mountedRef.current) setShowLabels(true);
  }, [note, isEmpty, saveNote]);

  const bgColor = NOTE_COLOR_LIGHT[form.color];

  if (loadingNote) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Appbar.Header style={{ backgroundColor: bgColor }} elevated={false}>
          <Appbar.BackAction onPress={handleBack} />
          <Appbar.Content title="" />
          <Appbar.Action
            icon={note?.isPinned ? 'pin' : 'pin-outline'}
            onPress={handlePin}
          />
          {note && (
            <Appbar.Action icon="delete-outline" onPress={handleDelete} />
          )}
          {saving && <ActivityIndicator size="small" style={{ marginRight: 8 }} />}
        </Appbar.Header>

        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <TextInput
            style={styles.titleInput}
            placeholder="タイトル"
            placeholderTextColor="#aaa"
            value={form.title}
            onChangeText={setTitle}
            multiline={false}
            returnKeyType="next"
          />

          <Divider style={styles.divider} />

          {form.type === 'TEXT' && (
            <TextInput
              style={styles.contentInput}
              placeholder="メモを入力..."
              placeholderTextColor="#aaa"
              value={form.content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
          )}

          {form.type === 'CHECKLIST' && (
            <View style={styles.checklist}>
              {form.checklistItems
                .filter((i) => !i.isChecked)
                .map((item) => (
                  <ChecklistRow
                    key={item.key}
                    itemKey={item.key}
                    text={item.text}
                    isChecked={item.isChecked}
                    onChangeText={updateChecklistItem}
                    onToggle={toggleChecklistItem}
                    onRemove={removeChecklistItem}
                  />
                ))}
              <TouchableOpacity
                style={styles.addItem}
                onPress={addChecklistItem}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="plus" size={18} color="#888" />
                <Text variant="bodyMedium" style={{ color: '#888' }}>アイテムを追加</Text>
              </TouchableOpacity>

              {form.checklistItems.some((i) => i.isChecked) && (
                <>
                  <Divider style={styles.divider} />
                  <Text variant="labelSmall" style={styles.doneLabel}>
                    チェック済み ({form.checklistItems.filter((i) => i.isChecked).length})
                  </Text>
                  {form.checklistItems
                    .filter((i) => i.isChecked)
                    .map((item) => (
                      <ChecklistRow
                        key={item.key}
                        itemKey={item.key}
                        text={item.text}
                        isChecked={item.isChecked}
                        onChangeText={updateChecklistItem}
                        onToggle={toggleChecklistItem}
                        onRemove={removeChecklistItem}
                        done
                      />
                    ))}
                </>
              )}
            </View>
          )}
        </ScrollView>

        <View style={[styles.bottomBar, { backgroundColor: bgColor }]}>
          <IconButton
            icon={form.type === 'TEXT' ? 'checkbox-marked-outline' : 'text'}
            size={22}
            onPress={() => setType(form.type === 'TEXT' ? 'CHECKLIST' : 'TEXT')}
          />
          <IconButton
            icon="palette-outline"
            size={22}
            onPress={() => setShowColor(true)}
          />
          {/* 新規ノートでも押せる（先に保存してからSheetを開く） */}
          <IconButton
            icon="label-outline"
            size={22}
            onPress={handleLabelPress}
          />
          {note && (
            <Text variant="labelSmall" style={styles.updatedAt}>
              {formatRelativeTime(note.updatedAt)}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      <ColorPicker
        visible={showColor}
        current={form.color}
        onSelect={setColor}
        onDismiss={() => setShowColor(false)}
      />

      {note && (
        <LabelPickerSheet
          visible={showLabels}
          noteId={note.id}
          currentLabels={note.labels}
          onDismiss={() => setShowLabels(false)}
          onChanged={handleLabelChanged}
        />
      )}

      <Snackbar
        visible={!!snackMsg}
        onDismiss={() => setSnackMsg('')}
        duration={2000}
      >
        {snackMsg}
      </Snackbar>
    </SafeAreaView>
  );
}

// ─── ChecklistRow (メモ化済み) ────────────────────────────────────────────────
// props をフラット化し onChangeText(key, text) のシグネチャにすることで
// 親から渡す stable な useCallback と組み合わせて不要な再レンダーを防ぐ

interface RowProps {
  itemKey:      string;
  text:         string;
  isChecked:    boolean;
  onChangeText: (key: string, text: string) => void;
  onToggle:     (key: string) => void;
  onRemove:     (key: string) => void;
  done?:        boolean;
}

const ChecklistRow = memo(function ChecklistRow({
  itemKey, text, isChecked, onChangeText, onToggle, onRemove, done,
}: RowProps) {
  return (
    <View style={rowStyles.row}>
      <TouchableOpacity
        onPress={() => onToggle(itemKey)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name={isChecked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
          size={22}
          color={isChecked ? '#999' : '#444'}
        />
      </TouchableOpacity>
      <TextInput
        style={[rowStyles.input, done && rowStyles.done]}
        value={text}
        onChangeText={(t) => onChangeText(itemKey, t)}
        placeholder="アイテム"
        placeholderTextColor="#bbb"
        multiline={false}
      />
      <TouchableOpacity
        onPress={() => onRemove(itemKey)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons name="close" size={18} color="#bbb" />
      </TouchableOpacity>
    </View>
  );
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    paddingVertical: 6,
    minHeight:       44,
  },
  input: { flex: 1, fontSize: 15, color: '#333' },
  done:  { textDecorationLine: 'line-through', color: '#999' },
});

const styles = StyleSheet.create({
  container:     { flex: 1 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:        { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 80 },
  titleInput: {
    fontSize:        20,
    fontWeight:      '600',
    color:           '#1a1a1a',
    paddingVertical: 4,
    marginBottom:    spacing.sm,
    minHeight:       44,
  },
  divider:      { marginVertical: spacing.sm },
  contentInput: {
    fontSize:   15,
    color:      '#333',
    minHeight:  200,
    lineHeight: 22,
  },
  checklist: { gap: 2 },
  addItem: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.xs,
    paddingVertical: spacing.sm,
    minHeight:       44,
  },
  doneLabel: { color: '#888', marginBottom: spacing.xs },
  bottomBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.sm,
    borderTopWidth:    1,
    borderTopColor:    '#eee',
    height:            52,
  },
  updatedAt: {
    color:       '#aaa',
    marginLeft:  'auto',
    marginRight: spacing.sm,
  },
});
