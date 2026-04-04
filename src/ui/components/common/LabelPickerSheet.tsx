import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Text, Portal, Modal, Checkbox, Divider, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Label } from '@/domain/entities/Label';
import { spacing } from '@/ui/theme/spacing';
import { getLabelRepository, getNoteRepository } from '@/lib/di';

interface Props {
  visible:       boolean;
  noteId:        number;
  currentLabels: Label[];
  onDismiss:     () => void;
  onChanged:     () => void;  // ラベル変更後のコールバック
}

export function LabelPickerSheet({
  visible, noteId, currentLabels, onDismiss, onChanged,
}: Props) {
  const [allLabels,  setAllLabels]  = useState<Label[]>([]);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [newName,    setNewName]     = useState('');
  const [creating,   setCreating]   = useState(false);

  useEffect(() => {
    if (!visible) return;
    getLabelRepository().findAll().then((ls) => {
      setAllLabels(ls);
      setSelected(new Set(currentLabels.map((l) => l.id)));
    });
  }, [visible, currentLabels]);

  const toggle = async (labelId: number) => {
    const repo = getNoteRepository();
    if (selected.has(labelId)) {
      await repo.detachLabel(noteId, labelId);
      setSelected((s) => { const n = new Set(s); n.delete(labelId); return n; });
    } else {
      await repo.attachLabel(noteId, labelId);
      setSelected((s) => new Set([...s, labelId]));
    }
    onChanged();
  };

  const createLabel = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const label = await getLabelRepository().create(name);
      await getNoteRepository().attachLabel(noteId, label.id);
      setAllLabels((ls) => [...ls, label]);
      setSelected((s) => new Set([...s, label.id]));
      setNewName('');
      onChanged();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <Text variant="titleSmall" style={styles.title}>ラベル</Text>

        {/* 検索 / 新規作成入力 */}
        <View style={styles.inputRow}>
          <MaterialCommunityIcons name="label-outline" size={18} color="#888" />
          <TextInput
            style={styles.input}
            placeholder="ラベルを検索または作成"
            placeholderTextColor="#aaa"
            value={newName}
            onChangeText={setNewName}
          />
          {newName.trim().length > 0 && (
            <Button
              compact
              loading={creating}
              onPress={createLabel}
            >
              作成
            </Button>
          )}
        </View>

        <Divider style={{ marginVertical: spacing.sm }} />

        {/* ラベル一覧 */}
        <FlatList
          data={allLabels.filter((l) =>
            !newName.trim() || l.name.includes(newName.trim()),
          )}
          keyExtractor={(item) => String(item.id)}
          style={{ maxHeight: 300 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => toggle(item.id)}
            >
              <Checkbox
                status={selected.has(item.id) ? 'checked' : 'unchecked'}
                onPress={() => toggle(item.id)}
              />
              <Text variant="bodyMedium">{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text variant="bodySmall" style={styles.empty}>
              {newName.trim() ? '「作成」で新規ラベルを追加' : 'ラベルがありません'}
            </Text>
          }
        />
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: '#fff',
    margin:          spacing.xl,
    borderRadius:    16,
    padding:         spacing.md,
  },
  title: {
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    borderWidth:   1,
    borderColor:   '#ddd',
    borderRadius:  8,
    paddingHorizontal: spacing.sm,
  },
  input: {
    flex:     1,
    height:   44,
    fontSize: 14,
    color:    '#333',
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical: 4,
  },
  empty: {
    color:     '#aaa',
    textAlign: 'center',
    padding:   spacing.md,
  },
});
