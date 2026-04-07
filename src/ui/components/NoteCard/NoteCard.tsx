import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Text, Chip, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Note } from '@/domain/entities/Note';
import { NOTE_COLOR_LIGHT, NOTE_COLOR_DARK } from '@/ui/theme/colors';
import { spacing } from '@/ui/theme/spacing';
import { formatRelativeTime } from '@/lib/dateUtils';

interface Props {
  note:    Note;
  /** stable な useCallback 関数を渡すこと（React.memo の効果を維持するため） */
  onPress: (note: Note) => void;
  isGrid?: boolean;
}

export const NoteCard = React.memo(function NoteCard({ note, onPress, isGrid = true }: Props) {
  const colorScheme = useColorScheme();
  const theme       = useTheme();
  const palette     = colorScheme === 'dark' ? NOTE_COLOR_DARK : NOTE_COLOR_LIGHT;
  const bgColor     = palette[note.color];
  const maxLines    = isGrid ? 5 : 2;
  const handlePress = useCallback(() => onPress(note), [onPress, note]);
  const subtleColor = theme.colors.onSurfaceVariant;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: bgColor }, isGrid ? styles.grid : styles.list]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      {/* タイトル */}
      {note.title.length > 0 && (
        <Text variant="titleSmall" style={styles.title} numberOfLines={1}>
          {note.title}
        </Text>
      )}

      {/* 本文 (テキストメモ) */}
      {note.type === 'TEXT' && note.content.length > 0 && (
        <Text variant="bodySmall" style={[styles.content, { color: theme.colors.onSurface }]} numberOfLines={maxLines}>
          {note.content}
        </Text>
      )}

      {/* チェックリストプレビュー */}
      {note.type === 'CHECKLIST' && (
        <ChecklistPreview items={note.checklistItems} maxLines={maxLines} />
      )}

      {/* フッター */}
      <View style={styles.footer}>
        {/* ラベル */}
        <View style={styles.labels}>
          {note.labels.slice(0, 2).map((label) => (
            <Chip
              key={label.id}
              compact
              style={styles.chip}
              textStyle={styles.chipText}
            >
              {label.name}
            </Chip>
          ))}
          {note.labels.length > 2 && (
            <Chip compact style={styles.chip} textStyle={styles.chipText}>
              +{note.labels.length - 2}
            </Chip>
          )}
        </View>

        {/* ピン留めアイコン */}
        {note.isPinned && (
          <MaterialCommunityIcons name="pin" size={14} color={subtleColor} />
        )}
      </View>

      {/* 更新時刻 (リストモード) */}
      {!isGrid && (
        <Text variant="labelSmall" style={[styles.time, { color: subtleColor }]}>
          {formatRelativeTime(note.updatedAt)}
        </Text>
      )}
    </TouchableOpacity>
  );
}); // React.memo 終わり

// ─── チェックリストプレビュー ───────────────────────────────────────────────

function ChecklistPreview({
  items,
  maxLines,
}: {
  items: Note['checklistItems'];
  maxLines: number;
}) {
  const theme    = useTheme();
  const visible  = items.slice(0, maxLines);
  const overflow = items.length - visible.length;

  return (
    <View style={styles.checklist}>
      {visible.map((item) => (
        <View key={item.id} style={styles.checkRow}>
          <MaterialCommunityIcons
            name={item.isChecked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
            size={14}
            color={item.isChecked ? theme.colors.onSurfaceDisabled : theme.colors.onSurface}
          />
          <Text
            variant="bodySmall"
            style={[
              styles.checkText,
              { color: item.isChecked ? theme.colors.onSurfaceDisabled : theme.colors.onSurface },
              item.isChecked && styles.checkDone,
            ]}
            numberOfLines={1}
          >
            {item.text}
          </Text>
        </View>
      ))}
      {overflow > 0 && (
        <Text variant="labelSmall" style={[styles.overflow, { color: theme.colors.onSurfaceVariant }]}>
          +{overflow}件
        </Text>
      )}
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius:  12,
    padding:       spacing.sm + 4,
    marginBottom:  spacing.sm,
    elevation:     1,
  },
  grid: {
    flex: 1,
  },
  list: {
    marginHorizontal: spacing.md,
  },
  title: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  content: {
    lineHeight: 18,
  },
  checklist: {
    gap: 2,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  checkText: {
    flex: 1,
  },
  checkDone: {
    textDecorationLine: 'line-through',
  },
  overflow: {
    marginTop: 2,
  },
  footer: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      spacing.xs,
  },
  labels: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           4,
    flex:          1,
  },
  chip: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    height:          26,
  },
  chipText: {
    fontSize:       10,
    lineHeight:     14,
    marginVertical: 0,
  },
  time: {
    color:     '#888',
    textAlign: 'right',
    marginTop: 2,
  },
});
