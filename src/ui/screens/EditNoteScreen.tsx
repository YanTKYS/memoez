import React, { useState, useEffect, useRef, useCallback, type MutableRefObject } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/ui/components/common/EmptyState';
import { ChecklistView } from '@/ui/components/EditNote/ChecklistView';
import { DueDatePickerModal } from '@/ui/components/EditNote/DueDatePickerModal';
import { NOTE_COLOR_LIGHT, NOTE_COLOR_DARK } from '@/ui/theme/colors';
import { spacing } from '@/ui/theme/spacing';
import { useEditNote } from '@/ui/hooks/useEditNote';
import { ColorPicker } from '@/ui/components/common/ColorPicker';
import { LabelPickerSheet } from '@/ui/components/common/LabelPickerSheet';
import { formatDueDateTime, formatRelativeTime } from '@/lib/dateUtils';

interface Props {
  noteId?: number;
  /** 保存完了後に画面を閉じる（通常画面では router.back()） */
  onExit: () => void;
  /** ラベル管理画面を開く */
  onOpenLabelManager: () => void;
  /**
   * 'floating': ホーム画面ウィジェットから開くフローティングウィンドウ内に表示する。
   * ウィンドウ自体がシステムバーの外側に配置されるため、上下のセーフエリア余白を付けない。
   */
  presentation?: 'screen' | 'floating';
  /**
   * ウィンドウ外タップなど、画面の外から「保存して閉じる」を呼ぶための ref。
   * 閉じたら true、保存に失敗して入力を残したら false で解決する。
   */
  closeRequestRef?: MutableRefObject<(() => Promise<boolean>) | null>;
}

export function EditNoteScreen({
  noteId,
  onExit,
  onOpenLabelManager,
  presentation = 'screen',
  closeRequestRef,
}: Props) {
  const isFloating = presentation === 'floating';
  const [showColor,    setShowColor]    = useState(false);
  const [showLabels,   setShowLabels]   = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);

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
    saveError,
    discardChangesAndExit,
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
  } = useEditNote(noteId, { onExit });

  // ─── Android ハードウェアバックボタン ─────────────────────────────────
  // handleBack が保存の完了を待ってから戻るので、保存中でも押せるようにしておく
  // （抑制すると、入力直後の自動保存中にボタンが効かず固まったように見える）
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  useEffect(() => {
    if (!closeRequestRef) return;
    closeRequestRef.current = handleBack;
    return () => { closeRequestRef.current = null; };
  }, [closeRequestRef, handleBack]);

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

  // ─── 期限モーダル（props は DueDatePickerModal の memo を効かせるため固定） ──
  const openDueModal  = useCallback(() => setShowDueModal(true),  []);
  const closeDueModal = useCallback(() => setShowDueModal(false), []);
  const submitDueAt   = useCallback((dueAt: Date | null) => {
    setDueAt(dueAt);
    setShowDueModal(false);
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

  // フローティング表示ではウィンドウの外側がシステムバーに接するため、余白は不要
  const appbarStatusBarHeight = isFloating ? 0 : undefined;
  const closeAction = isFloating
    ? <Appbar.Action icon="close" accessibilityLabel="閉じる" onPress={handleBack} />
    : <Appbar.BackAction onPress={handleBack} />;

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={isFloating ? [] : ['top']}>
        <Appbar.Header elevated={false} statusBarHeight={appbarStatusBarHeight}>
          {closeAction}
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: bgColor }]}
      edges={isFloating ? [] : ['top', 'bottom']}
    >
      {/*
        Android: behavior を指定しない（undefined）ことで高さが縮まらず自然なスクロール動作になる。
        softwareKeyboardLayoutMode: "pan" を app.json に設定済み。
        iOS: 'padding' で入力欄がキーボード上に浮く。
      */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Appbar.Header
          style={{ backgroundColor: bgColor }}
          elevated={false}
          statusBarHeight={appbarStatusBarHeight}
        >
          {closeAction}
          <Appbar.Content title="" />
          <Appbar.Action
            icon={note?.isPinned ? 'pin' : 'pin-outline'}
            onPress={handlePin}
          />
          {note && (
            <Appbar.Action icon="delete-outline" onPress={handleDelete} />
          )}
          {saving && <ActivityIndicator size="small" style={styles.savingSpinner} />}
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

          {form.type === 'TEXT' ? (
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
          ) : (
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
            onPress={openDueModal}
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

      <DueDatePickerModal
        visible={showDueModal}
        value={form.dueAt}
        onDismiss={closeDueModal}
        onSubmit={submitDueAt}
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
            onOpenLabelManager();
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

      {/* 保存に失敗した間は消さない。閉じる操作は保存できるまで行わない（再度閉じると再試行） */}
      <Snackbar
        visible={saveError}
        onDismiss={() => {}}
        duration={Number.POSITIVE_INFINITY}
        action={{ label: '破棄して閉じる', onPress: discardChangesAndExit }}
      >
        保存できませんでした。入力内容は残っています
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
    marginLeft:  spacing.xs,
    marginRight: spacing.xs,
  },
  savingSpinner:  { marginRight: spacing.sm },
  savedIndicator: { marginRight: spacing.sm },
  notificationGuide: {
    fontSize:          12,
    paddingHorizontal: spacing.md,
    paddingBottom:     spacing.sm,
  },
});
