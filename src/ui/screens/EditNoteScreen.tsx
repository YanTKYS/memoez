import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/ui/components/common/EmptyState';
import { ChecklistView } from '@/ui/components/EditNote/ChecklistView';
import { NOTE_COLOR_LIGHT } from '@/ui/theme/colors';
import { spacing } from '@/ui/theme/spacing';
import { useEditNote } from '@/ui/hooks/useEditNote';
import { ColorPicker } from '@/ui/components/common/ColorPicker';
import { LabelPickerSheet } from '@/ui/components/common/LabelPickerSheet';
import { formatRelativeTime } from '@/lib/dateUtils';

interface Props {
  noteId?: number;
}

export function EditNoteScreen({ noteId }: Props) {
  const [showColor,  setShowColor]  = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  // contentInput の ref（タイトルの returnKeyType="next" でフォーカス移動するため）
  const contentInputRef = useRef<TextInput>(null);

  const {
    note,
    loading,
    loadError,
    saving,
    lastSavedAt,
    snackMsg,
    setSnackMsg,
    form,
    setTitle,
    setContent,
    setType,
    setColor,
    addChecklistItem,
    updateChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    lastAddedKey,
    handleBack,       // stableHandleBack が返ってくる（再生成されない）
    handleDelete,
    handlePin,
    prepareForLabels,
    fetchLabels,
    toggleNoteLabel,
    createAndAttachLabel,
  } = useEditNote(noteId);

  // ─── Android ハードウェアバックボタン ─────────────────────────────────
  // handleBack は stable (stableHandleBack) なので再登録されない
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  // ─── ラベルボタン ─────────────────────────────────────────────────────
  const handleLabelPress = useCallback(async () => {
    const ok = await prepareForLabels();
    if (ok) setShowLabels(true);
  }, [prepareForLabels]);

  const bgColor = NOTE_COLOR_LIGHT[form.color];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Appbar.Header elevated={false}>
          <Appbar.BackAction onPress={handleBack} />
        </Appbar.Header>
        <EmptyState
          icon="alert-circle-outline"
          title="読み込みエラー"
          message={loadError}
          action={{ label: '戻る', onPress: handleBack }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top', 'bottom']}>
      {/*
        Android: behavior を指定しない（undefined）ことで高さが縮まらず自然なスクロール動作になる。
        softwareKeyboardLayoutMode: "pan" を app.json に設定済み。
        iOS: 'padding' で入力欄がキーボード上に浮く。
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          {!saving && lastSavedAt && (
            <Text variant="labelSmall" style={styles.savedIndicator}>保存しました</Text>
          )}
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
            blurOnSubmit={false}
            onSubmitEditing={() => contentInputRef.current?.focus()}
          />

          <Divider style={styles.divider} />

          {form.type === 'TEXT' && (
            <TextInput
              ref={contentInputRef}
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
            <ChecklistView
              items={form.checklistItems}
              lastAddedKey={lastAddedKey}
              onAdd={addChecklistItem}
              onUpdate={updateChecklistItem}
              onToggle={toggleChecklistItem}
              onRemove={removeChecklistItem}
            />
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
          currentLabels={note.labels}
          onDismiss={() => setShowLabels(false)}
          onFetchLabels={fetchLabels}
          onToggleLabel={toggleNoteLabel}
          onCreateLabel={createAndAttachLabel}
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
  savedIndicator: {
    color:       '#4caf50',
    marginRight: spacing.sm,
  },
});
