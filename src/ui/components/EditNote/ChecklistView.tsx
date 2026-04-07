import React, { memo, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Text, Divider, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing } from '@/ui/theme/spacing';
import type { DraftChecklistItem } from '@/ui/hooks/useNoteForm';

interface Props {
  items:          DraftChecklistItem[];
  lastAddedKey:   string | null;
  onAdd:          () => void;
  onUpdate:       (key: string, text: string) => void;
  onToggle:       (key: string) => void;
  onRemove:       (key: string) => void;
}

export const ChecklistView = memo(function ChecklistView({
  items, lastAddedKey, onAdd, onUpdate, onToggle, onRemove,
}: Props) {
  const theme     = useTheme();
  const unchecked = items.filter((i) => !i.isChecked);
  const checked   = items.filter((i) =>  i.isChecked);

  return (
    <View style={styles.container}>
      {unchecked.map((item) => (
        <ChecklistRow
          key={item.key}
          itemKey={item.key}
          text={item.text}
          isChecked={false}
          onChangeText={onUpdate}
          onToggle={onToggle}
          onRemove={onRemove}
          shouldFocus={item.key === lastAddedKey}
        />
      ))}

      <TouchableOpacity
        style={styles.addItem}
        onPress={onAdd}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons name="plus" size={18} color={theme.colors.onSurfaceVariant} />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>アイテムを追加</Text>
      </TouchableOpacity>

      {checked.length > 0 && (
        <>
          <Divider style={styles.divider} />
          <Text variant="labelSmall" style={[styles.doneLabel, { color: theme.colors.onSurfaceVariant }]}>
            チェック済み ({checked.length})
          </Text>
          {checked.map((item) => (
            <ChecklistRow
              key={item.key}
              itemKey={item.key}
              text={item.text}
              isChecked={true}
              onChangeText={onUpdate}
              onToggle={onToggle}
              onRemove={onRemove}
              done
            />
          ))}
        </>
      )}
    </View>
  );
});

// ─── ChecklistRow ────────────────────────────────────────────────────────────

interface RowProps {
  itemKey:      string;
  text:         string;
  isChecked:    boolean;
  onChangeText: (key: string, text: string) => void;
  onToggle:     (key: string) => void;
  onRemove:     (key: string) => void;
  done?:        boolean;
  shouldFocus?: boolean;
}

const ChecklistRow = memo(function ChecklistRow({
  itemKey, text, isChecked, onChangeText, onToggle, onRemove, done, shouldFocus,
}: RowProps) {
  const theme    = useTheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!shouldFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [shouldFocus]);

  return (
    <View style={rowStyles.row}>
      <TouchableOpacity
        onPress={() => onToggle(itemKey)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name={isChecked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
          size={22}
          color={isChecked ? theme.colors.onSurfaceDisabled : theme.colors.onSurface}
        />
      </TouchableOpacity>
      <TextInput
        ref={inputRef}
        style={[
          rowStyles.input,
          { color: isChecked ? theme.colors.onSurfaceDisabled : theme.colors.onSurface },
          done && rowStyles.done,
        ]}
        value={text}
        onChangeText={(t) => onChangeText(itemKey, t)}
        placeholder="アイテム"
        placeholderTextColor={theme.colors.onSurfaceDisabled}
        multiline={false}
      />
      <TouchableOpacity
        onPress={() => onRemove(itemKey)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
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
  input: { flex: 1, fontSize: 15 },
  done:  { textDecorationLine: 'line-through' },
});

const styles = StyleSheet.create({
  container: { gap: 2 },
  addItem: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.xs,
    paddingVertical: spacing.sm,
    minHeight:       44,
  },
  doneLabel: { marginBottom: spacing.xs },
  divider:   { marginVertical: spacing.sm },
});
