import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Alert,
  useColorScheme,
} from 'react-native';
import {
  Appbar,
  Text,
  IconButton,
  Divider,
  ActivityIndicator,
  Snackbar,
  useTheme,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/ui/components/common/EmptyState';
import { ChecklistView } from '@/ui/components/EditNote/ChecklistView';
import { NOTE_COLOR_LIGHT, NOTE_COLOR_DARK } from '@/ui/theme/colors';
import { spacing } from '@/ui/theme/spacing';
import { useEditNote } from '@/ui/hooks/useEditNote';
import { ColorPicker } from '@/ui/components/common/ColorPicker';
import { LabelPickerSheet } from '@/ui/components/common/LabelPickerSheet';
import { formatDueDateTime, formatRelativeTime } from '@/lib/dateUtils';
import { buildDueDatePresets } from '@/ui/hooks/dueDatePresets';

interface Props {
  noteId?: number;
}

export function EditNoteScreen({ noteId }: Props) {
  const router = useRouter();
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
    setDueAt,
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
  } = useEditNote(noteId);

  // ─── Android ハードウェアバックボタン ─────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saving) return true; // 保存完了まで back を抑制
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack, saving]);

  // ─── タイプ切り替え（本文がある場合は確認） ──────────────────────────
  const handleTypeChange = useCallback(() => {
    if (form.type === 'TEXT' && form.content.trim()) {
      Alert.alert(
        'タイプを変更',
        'チェックリストに変更すると入力中の本文は失われます。続けますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '変更する', style: 'destructive', onPress: () => setType('CHECKLIST') },
        ],
      );
    } else {
      setType(form.type === 'TEXT' ? 'CHECKLIST' : 'TEXT');
    }
  }, [form.type, form.content, setType]);

  // ─── ラベルボタン ─────────────────────────────────────────────────────
  const handleLabelPress = useCallback(async () => {
    const ok = await prepareForLabels();
    if (ok) setShowLabels(true);
  }, [prepareForLabels]);

  const handleDueAtPress = useCallback(() => {
    const presets = buildDueDatePresets(new Date());
    Alert.alert('期限を設定', '期限を選択してください', [
      ...presets.map((preset) => ({
        text: preset.label,
        style: preset.destructive ? 'destructive' as const : 'default' as const,
        onPress: () => setDueAt(preset.value),
      })),
      { text: 'キャンセル', style: 'cancel' },
    ]);
  }, [setDueAt]);

  const colorScheme = useColorScheme();
  const theme       = useTheme();
  const palette     = colorScheme === 'dark' ? NOTE_COLOR_DARK : NOTE_COLOR_LIGHT;
  const bgColor     = palette[form.color];

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
            <Text variant="labelSmall" style={[styles.savedIndicator, { color: theme.colors.primary }]}>保存しました</Text>
          )}
        </Appbar.Header>

        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <TextInput
            style={[styles.titleInput, { color: theme.colors.onSurface }]}
            placeholder="タイトル"
            placeholderTextColor={theme.colors.onSurfaceDisabled}
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
              style={[styles.contentInput, { color: theme.colors.onSurface }]}
              placeholder="メモを入力..."
              placeholderTextColor={theme.colors.onSurfaceDisabled}
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

        <View style={[styles.bottomBar, { backgroundColor: bgColor, borderTopColor: theme.colors.outlineVariant }]}>
          <IconButton
            icon={form.type === 'TEXT' ? 'checkbox-marked-outline' : 'text'}
            size={22}
            onPress={handleTypeChange}
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
          <IconButton
            icon="calendar-clock-outline"
            size={22}
            onPress={handleDueAtPress}
          />
          {form.dueAt && (
            <Text variant="labelSmall" style={[styles.dueAt, { color: theme.colors.onSurfaceVariant }]}>
              {formatDueDateTime(form.dueAt)}
            </Text>
          )}
          {note && (
            <Text variant="labelSmall" style={[styles.updatedAt, { color: theme.colors.onSurfaceVariant }]}>
              {formatRelativeTime(note.updatedAt)}
            </Text>
          )}
        </View>
        {form.dueAt && (
          <Text style={[styles.notificationGuide, { color: theme.colors.onSurfaceVariant }]}>
            リマインド通知には端末の通知許可が必要です（設定 ＞ アプリ通知）。
          </Text>
        )}
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
          onOpenLabelManager={() => {
            setShowLabels(false);
            router.push('/labels');
          }}
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
    paddingVertical: 4,
    marginBottom:    spacing.sm,
    minHeight:       44,
  },
  divider:      { marginVertical: spacing.sm },
  contentInput: {
    fontSize:   15,
    minHeight:  200,
    lineHeight: 22,
  },
  bottomBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.sm,
    borderTopWidth:    1,
    height:            52,
  },
  updatedAt: {
    marginLeft:  'auto',
    marginRight: spacing.sm,
  },
  dueAt: {
    marginLeft: spacing.xs,
    marginRight: spacing.xs,
  },
  savedIndicator: {
    marginRight: spacing.sm,
  },
  notificationGuide: {
    fontSize: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
});
