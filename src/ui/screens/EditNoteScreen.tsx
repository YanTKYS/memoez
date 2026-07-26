import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Portal,
  Modal,
  Button,
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
import { buildDueDatePresets, type DueDatePreset } from '@/ui/hooks/dueDatePresets';

interface Props {
  noteId?: number;
}

export function EditNoteScreen({ noteId }: Props) {
  const router = useRouter();
  const [showColor,  setShowColor]  = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);
  const [dueDraft, setDueDraft] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [duePresets, setDuePresets] = useState<DueDatePreset[]>([]);

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
    const base = form.dueAt ?? new Date();
    setDueDraft(base);
    setCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setDuePresets(buildDueDatePresets(new Date()));
    setShowDueModal(true);
  }, [form.dueAt]);

  const applyDuePreset = useCallback((preset: DueDatePreset) => {
    setDueAt(preset.value);
    setShowDueModal(false);
  }, [setDueAt]);

  const shiftCalendarMonth = useCallback((delta: number) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }, []);

  const shiftCalendarYear = useCallback((delta: number) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear() + delta, prev.getMonth(), 1));
  }, []);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const startOffset = firstOfMonth.getDay();
    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - startOffset);

    return Array.from({ length: 42 }).map((_, idx) => {
      const cell = new Date(startDate);
      cell.setDate(startDate.getDate() + idx);
      return cell;
    });
  }, [calendarMonth]);

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

      <Portal>
        <Modal
          visible={showDueModal}
          onDismiss={() => setShowDueModal(false)}
          contentContainerStyle={[styles.dueModal, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium">期限を設定</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            日付はカレンダー、時刻は時分の選択で設定できます。
          </Text>
          <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
            選択中: {formatDueDateTime(dueDraft)}
          </Text>

          <View style={styles.presetRow}>
            {duePresets.map((preset) => (
              <Button
                key={preset.label}
                compact
                mode={preset.destructive ? 'text' : 'outlined'}
                textColor={preset.destructive ? theme.colors.error : undefined}
                onPress={() => applyDuePreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </View>

          <View style={styles.calendarHeader}>
            <Button compact onPress={() => shiftCalendarYear(-1)}>-1年</Button>
            <Button compact onPress={() => shiftCalendarMonth(-1)}>前月</Button>
            <Text style={styles.calendarTitle}>{`${calendarMonth.getFullYear()}年 ${calendarMonth.getMonth() + 1}月`}</Text>
            <Button compact onPress={() => shiftCalendarMonth(1)}>次月</Button>
            <Button compact onPress={() => shiftCalendarYear(1)}>+1年</Button>
          </View>

          <View style={styles.weekRow}>
            {['日', '月', '火', '水', '木', '金', '土'].map((w) => (
              <Text key={w} style={styles.weekCell}>{w}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarCells.map((cell) => {
              const inMonth = cell.getMonth() === calendarMonth.getMonth();
              const selected =
                cell.getFullYear() === dueDraft.getFullYear() &&
                cell.getMonth() === dueDraft.getMonth() &&
                cell.getDate() === dueDraft.getDate();
              return (
                <Button
                  key={cell.toISOString()}
                  compact
                  mode={selected ? 'contained' : 'text'}
                  textColor={inMonth ? undefined : theme.colors.onSurfaceDisabled}
                  onPress={() => {
                    setDueDraft((prev) => {
                      const next = new Date(prev);
                      next.setFullYear(cell.getFullYear(), cell.getMonth(), cell.getDate());
                      return next;
                    });
                  }}
                  style={styles.dayCell}
                >
                  {cell.getDate()}
                </Button>
              );
            })}
          </View>

          <Text variant="labelLarge">時</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineRow}>
            {Array.from({ length: 24 }).map((_, hour) => {
              const selected = dueDraft.getHours() === hour;
              return (
                <Button
                  key={`h-${hour}`}
                  compact
                  mode={selected ? 'contained' : 'outlined'}
                  onPress={() => setDueDraft((prev) => {
                    const next = new Date(prev);
                    next.setHours(hour);
                    return next;
                  })}
                >
                  {`${hour}`.padStart(2, '0')}
                </Button>
              );
            })}
          </ScrollView>

          <Text variant="labelLarge">分</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineRow}>
            {Array.from({ length: 12 }).map((_, idx) => {
              const minute = idx * 5;
              const selected = dueDraft.getMinutes() === minute;
              return (
                <Button
                  key={`m-${minute}`}
                  compact
                  mode={selected ? 'contained' : 'outlined'}
                  onPress={() => setDueDraft((prev) => {
                    const next = new Date(prev);
                    next.setMinutes(minute);
                    return next;
                  })}
                >
                  {`${minute}`.padStart(2, '0')}
                </Button>
              );
            })}
          </ScrollView>

          <Button mode="text" onPress={() => {
            const now = new Date();
            setDueDraft(now);
            setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
          }}
          >
            現在日時にリセット
          </Button>

          <View style={styles.dueActions}>
            <Button onPress={() => setShowDueModal(false)}>キャンセル</Button>
            <Button
              mode="contained"
              onPress={() => {
                setDueAt(dueDraft);
                setShowDueModal(false);
              }}
            >
              設定
            </Button>
            <Button
              onPress={() => {
                setDueAt(null);
                setShowDueModal(false);
              }}
            >
              解除
            </Button>
          </View>
        </Modal>
      </Portal>

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
  dueModal: {
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarTitle: {
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekCell: {
    width: 36,
    textAlign: 'center',
    color: '#9CA3AF',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayCell: {
    width: 40,
  },
  dueActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
});
