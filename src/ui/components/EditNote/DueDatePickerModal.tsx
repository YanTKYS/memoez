import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { spacing } from '@/ui/theme/spacing';
import { formatDueDateTime } from '@/lib/dateUtils';
import { buildDueDatePresets, type DueDatePreset } from '@/ui/hooks/dueDatePresets';

const WEEK_LABELS    = ['日', '月', '火', '水', '木', '金', '土'];
/** 6 週 × 7 日 */
const CALENDAR_CELLS = 42;
const MINUTE_STEP    = 5;
const HOURS   = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, idx) => idx * MINUTE_STEP);

/** 分の選択肢は 5 分刻みなので、初期値も同じ刻みに丸めておく（どの選択肢も選ばれない状態を防ぐ） */
export function roundToMinuteStep(date: Date): Date {
  const rounded = new Date(date);
  rounded.setMinutes(Math.round(date.getMinutes() / MINUTE_STEP) * MINUTE_STEP, 0, 0);
  return rounded;
}

/** 月カレンダーに並べる 42 日分（前後の月にはみ出す分を含む） */
export function buildCalendarCells(month: Date): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(1 - firstOfMonth.getDay());
  return Array.from({ length: CALENDAR_CELLS }, (_, idx) => {
    const cell = new Date(start);
    cell.setDate(start.getDate() + idx);
    return cell;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth()    === b.getMonth()
    && a.getDate()     === b.getDate();
}

interface Props {
  visible:   boolean;
  /** 現在設定されている期限。未設定なら現在時刻から編集を始める */
  value:     Date | null;
  onDismiss: () => void;
  onSubmit:  (dueAt: Date | null) => void;
}

/**
 * 期限設定モーダル。
 * ボタンを 70 個以上並べるため、メモ本文の入力ごとに作り直されないよう
 * React.memo で切り出している（props はすべて呼び出し元で安定させること）。
 */
export const DueDatePickerModal = React.memo(function DueDatePickerModal({
  visible, value, onDismiss, onSubmit,
}: Props) {
  const theme = useTheme();
  const [draft,         setDraft]         = useState<Date>(() => roundToMinuteStep(new Date()));
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [presets,       setPresets]       = useState<DueDatePreset[]>([]);

  // 開くたびに現在の期限を初期値として読み直す
  useEffect(() => {
    if (!visible) return;
    const base = roundToMinuteStep(value ?? new Date());
    setDraft(base);
    setCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setPresets(buildDueDatePresets(new Date()));
  }, [visible, value]);

  const calendarCells = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);

  const shiftMonth = useCallback((delta: number) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }, []);

  const shiftYear = useCallback((delta: number) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear() + delta, prev.getMonth(), 1));
  }, []);

  const selectDay = useCallback((cell: Date) => {
    setDraft((prev) => {
      const next = new Date(prev);
      next.setFullYear(cell.getFullYear(), cell.getMonth(), cell.getDate());
      return next;
    });
  }, []);

  const selectHour = useCallback((hour: number) => {
    setDraft((prev) => {
      const next = new Date(prev);
      next.setHours(hour);
      return next;
    });
  }, []);

  const selectMinute = useCallback((minute: number) => {
    setDraft((prev) => {
      const next = new Date(prev);
      next.setMinutes(minute, 0, 0);
      return next;
    });
  }, []);

  const resetToNow = useCallback(() => {
    const now = roundToMinuteStep(new Date());
    setDraft(now);
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleMedium">期限を設定</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          日付はカレンダー、時刻は時分の選択で設定できます。
        </Text>
        <Text variant="bodyMedium" style={styles.selectedText}>
          選択中: {formatDueDateTime(draft)}
        </Text>

        <View style={styles.presetRow}>
          {presets.map((preset) => (
            <Button
              key={preset.label}
              compact
              mode={preset.destructive ? 'text' : 'outlined'}
              textColor={preset.destructive ? theme.colors.error : undefined}
              onPress={() => onSubmit(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </View>

        <View style={styles.calendarHeader}>
          <Button compact onPress={() => shiftYear(-1)}>-1年</Button>
          <Button compact onPress={() => shiftMonth(-1)}>前月</Button>
          <Text style={styles.calendarTitle}>
            {`${calendarMonth.getFullYear()}年 ${calendarMonth.getMonth() + 1}月`}
          </Text>
          <Button compact onPress={() => shiftMonth(1)}>次月</Button>
          <Button compact onPress={() => shiftYear(1)}>+1年</Button>
        </View>

        <View style={styles.weekRow}>
          {WEEK_LABELS.map((week) => (
            <Text key={week} style={[styles.weekCell, { color: theme.colors.onSurfaceVariant }]}>{week}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarCells.map((cell) => (
            <Button
              key={cell.getTime()}
              compact
              mode={isSameDay(cell, draft) ? 'contained' : 'text'}
              textColor={cell.getMonth() === calendarMonth.getMonth() ? undefined : theme.colors.onSurfaceDisabled}
              onPress={() => selectDay(cell)}
              style={styles.dayCell}
            >
              {cell.getDate()}
            </Button>
          ))}
        </View>

        <Text variant="labelLarge">時</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineRow}>
          {HOURS.map((hour) => (
            <Button
              key={`h-${hour}`}
              compact
              mode={draft.getHours() === hour ? 'contained' : 'outlined'}
              onPress={() => selectHour(hour)}
            >
              {`${hour}`.padStart(2, '0')}
            </Button>
          ))}
        </ScrollView>

        <Text variant="labelLarge">分</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineRow}>
          {MINUTES.map((minute) => (
            <Button
              key={`m-${minute}`}
              compact
              mode={draft.getMinutes() === minute ? 'contained' : 'outlined'}
              onPress={() => selectMinute(minute)}
            >
              {`${minute}`.padStart(2, '0')}
            </Button>
          ))}
        </ScrollView>

        <Button mode="text" onPress={resetToNow}>現在日時にリセット</Button>

        <View style={styles.actions}>
          <Button onPress={onDismiss}>キャンセル</Button>
          <Button mode="contained" onPress={() => onSubmit(draft)}>設定</Button>
          <Button onPress={() => onSubmit(null)}>解除</Button>
        </View>
      </Modal>
    </Portal>
  );
});

const styles = StyleSheet.create({
  modal: {
    margin:       spacing.md,
    padding:      spacing.md,
    borderRadius: 12,
    gap:          spacing.sm,
  },
  selectedText: { fontWeight: '600' },
  presetRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  calendarHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  calendarTitle: { fontWeight: '600' },
  weekRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  weekCell: {
    width:     36,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           4,
  },
  dayCell: { width: 40 },
  actions: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    gap:            spacing.xs,
  },
});
