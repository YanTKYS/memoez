import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  const router              = useRouter();
  const [note, setNote]     = useState<Note | null>(null);
  const [loadingNote, setLoadingNote] = useState(!!noteId);
  const [saving, setSaving] = useState(false);
  const [showColor,  setShowColor]  = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [snackMsg,   setSnackMsg]   = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    form,
    setTitle, setContent, setType, setColor,
    addChecklistItem, updateChecklistItem,
    toggleChecklistItem, removeChecklistItem,
    isEmpty,
  } = useNoteForm(note ?? undefined);

  // ─── 既存ノート読み込み ──────────────────────────────────────────────────
  useEffect(() => {
    if (!noteId) return;
    getNoteRepository()
      .findById(noteId)
      .then((n) => { setNote(n); setLoadingNote(false); })
      .catch(() => { setLoadingNote(false); });
  }, [noteId]);

  // ─── 自動保存 (debounce 1秒) ─────────────────────────────────────────────
  useEffect(() => {
    if (loadingNote) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveNote(); }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [form.title, form.content, form.type, form.color, form.checklistItems]); // eslint-disable-line

  // ─── 保存ロジック ────────────────────────────────────────────────────────
  const saveNote = async (showFeedback = false) => {
    if (isEmpty()) return;
    setSaving(true);
    try {
      const repo  = getNoteRepository();
      const items = form.checklistItems
        .filter((i) => i.text.trim())
        .map((i, idx) => ({ text: i.text, isChecked: i.isChecked, position: idx * 1000 }));

      if (note) {
        // 更新
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
        // 新規作成
        const created = await repo.create({
          title:   form.title,
          content: form.content,
          type:    form.type,
          color:   form.color,
        });
        setNote(created);
        if (form.type === 'CHECKLIST') {
          await repo.updateChecklistItems(created.id, items);
        }
      }
      if (showFeedback) setSnackMsg('保存しました');
    } catch (e) {
      console.error(e);
      if (showFeedback) setSnackMsg('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // ─── 戻る ────────────────────────────────────────────────────────────────
  const handleBack = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (!isEmpty()) await saveNote();
    router.back();
  };

  // ─── 削除 ────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert('メモを削除', 'このメモを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          if (note) await getNoteRepository().delete(note.id);
          router.back();
        },
      },
    ]);
  };

  // ─── ピン留めトグル ──────────────────────────────────────────────────────
  const handlePin = async () => {
    if (!note) return;
    const repo    = getNoteRepository();
    const updated = await repo._togglePin(note.id);
    setNote(updated);
  };

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
        {/* AppBar */}
        <Appbar.Header style={{ backgroundColor: bgColor }} elevated={false}>
          <Appbar.BackAction onPress={handleBack} />
          <Appbar.Content title="" />
          {note && (
            <Appbar.Action
              icon={note.isPinned ? 'pin' : 'pin-outline'}
              onPress={handlePin}
            />
          )}
          {note && (
            <Appbar.Action icon="delete-outline" onPress={handleDelete} />
          )}
          {saving && <ActivityIndicator size="small" style={{ marginRight: 8 }} />}
        </Appbar.Header>

        {/* 本文エリア */}
        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* タイトル */}
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

          {/* テキスト本文 */}
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

          {/* チェックリスト */}
          {form.type === 'CHECKLIST' && (
            <View style={styles.checklist}>
              {form.checklistItems
                .filter((i) => !i.isChecked)
                .map((item) => (
                  <ChecklistRow
                    key={item.key}
                    item={item}
                    onChangeText={(t) => updateChecklistItem(item.key, t)}
                    onToggle={() => toggleChecklistItem(item.key)}
                    onRemove={() => removeChecklistItem(item.key)}
                  />
                ))}
              <TouchableOpacity style={styles.addItem} onPress={addChecklistItem}>
                <MaterialCommunityIcons name="plus" size={18} color="#888" />
                <Text variant="bodyMedium" style={{ color: '#888' }}>アイテムを追加</Text>
              </TouchableOpacity>

              {/* チェック済み */}
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
                        item={item}
                        onChangeText={(t) => updateChecklistItem(item.key, t)}
                        onToggle={() => toggleChecklistItem(item.key)}
                        onRemove={() => removeChecklistItem(item.key)}
                        done
                      />
                    ))}
                </>
              )}
            </View>
          )}
        </ScrollView>

        {/* BottomBar */}
        <View style={[styles.bottomBar, { backgroundColor: bgColor }]}>
          {/* タイプ切替 */}
          <IconButton
            icon={form.type === 'TEXT' ? 'checkbox-marked-outline' : 'text'}
            size={22}
            onPress={() => setType(form.type === 'TEXT' ? 'CHECKLIST' : 'TEXT')}
          />
          {/* 色変更 */}
          <IconButton
            icon="palette-outline"
            size={22}
            onPress={() => setShowColor(true)}
          />
          {/* ラベル (既存ノートのみ) */}
          {note && (
            <IconButton
              icon="label-outline"
              size={22}
              onPress={() => setShowLabels(true)}
            />
          )}
          {/* 更新時刻 */}
          {note && (
            <Text variant="labelSmall" style={styles.updatedAt}>
              {formatRelativeTime(note.updatedAt)}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* カラーピッカー */}
      <ColorPicker
        visible={showColor}
        current={form.color}
        onSelect={setColor}
        onDismiss={() => setShowColor(false)}
      />

      {/* ラベルピッカー */}
      {note && (
        <LabelPickerSheet
          visible={showLabels}
          noteId={note.id}
          currentLabels={note.labels}
          onDismiss={() => setShowLabels(false)}
          onChanged={async () => {
            const updated = await getNoteRepository().findById(note.id);
            if (updated) setNote(updated);
          }}
        />
      )}

      {/* スナックバー */}
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

// ─── ChecklistRow ─────────────────────────────────────────────────────────────

interface RowProps {
  item:          { key: string; text: string; isChecked: boolean };
  onChangeText:  (v: string) => void;
  onToggle:      () => void;
  onRemove:      () => void;
  done?:         boolean;
}

function ChecklistRow({ item, onChangeText, onToggle, onRemove, done }: RowProps) {
  return (
    <View style={rowStyles.row}>
      <TouchableOpacity onPress={onToggle} hitSlop={8}>
        <MaterialCommunityIcons
          name={item.isChecked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
          size={22}
          color={item.isChecked ? '#999' : '#444'}
        />
      </TouchableOpacity>
      <TextInput
        style={[rowStyles.input, done && rowStyles.done]}
        value={item.text}
        onChangeText={onChangeText}
        placeholder="アイテム"
        placeholderTextColor="#bbb"
        multiline={false}
      />
      <TouchableOpacity onPress={onRemove} hitSlop={8}>
        <MaterialCommunityIcons name="close" size={18} color="#bbb" />
      </TouchableOpacity>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    paddingVertical: 4,
  },
  input: {
    flex:     1,
    fontSize: 15,
    color:    '#333',
  },
  done: {
    textDecorationLine: 'line-through',
    color:              '#999',
  },
});

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 80,
  },
  titleInput: {
    fontSize:    20,
    fontWeight:  '600',
    color:       '#1a1a1a',
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  divider:      { marginVertical: spacing.sm },
  contentInput: {
    fontSize:    15,
    color:       '#333',
    minHeight:   200,
    lineHeight:  22,
  },
  checklist:    { gap: 2 },
  addItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    paddingVertical: spacing.sm,
  },
  doneLabel: {
    color:     '#888',
    marginBottom: spacing.xs,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    height: 52,
  },
  updatedAt: {
    color:      '#aaa',
    marginLeft: 'auto',
    marginRight: spacing.sm,
  },
});
