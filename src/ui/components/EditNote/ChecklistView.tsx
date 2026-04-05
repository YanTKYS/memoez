import React, { memo } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Text, Divider } from 'react-native-paper';
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
          autoFocus={item.key === lastAddedKey}
        />
      ))}

      <TouchableOpacity
        style={styles.addItem}
        onPress={onAdd}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons name="plus" size={18} color="#888" />
        <Text variant="bodyMedium" style={{ color: '#888' }}>アイテムを追加</Text>
      </TouchableOpacity>

      {checked.length > 0 && (
        <>
          <Divider style={styles.divider} />
          <Text variant="labelSmall" style={styles.doneLabel}>
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
  autoFocus?:   boolean;
}

const ChecklistRow = memo(function ChecklistRow({
  itemKey, text, isChecked, onChangeText, onToggle, onRemove, done, autoFocus,
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
        autoFocus={autoFocus}
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
  container: { gap: 2 },
  addItem: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.xs,
    paddingVertical: spacing.sm,
    minHeight:       44,
  },
  doneLabel: { color: '#888', marginBottom: spacing.xs },
  divider:   { marginVertical: spacing.sm },
});
