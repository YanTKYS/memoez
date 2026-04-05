import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Text, Portal, Modal, Checkbox, Divider, Button, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Label } from '@/domain/entities/Label';
import { spacing } from '@/ui/theme/spacing';

interface Props {
  visible:        boolean;
  currentLabels:  Label[];
  onDismiss:      () => void;
  /** ラベル一覧を取得する（DB 操作は呼び出し元が担う） */
  onFetchLabels:  () => Promise<Label[]>;
  /** ラベルのアタッチ/デタッチを切り替える */
  onToggleLabel:  (labelId: number, currentlyAttached: boolean) => Promise<void>;
  /** 新規ラベルを作成してアタッチする */
  onCreateLabel:  (name: string) => Promise<Label>;
}

export function LabelPickerSheet({
  visible, currentLabels, onDismiss,
  onFetchLabels, onToggleLabel, onCreateLabel,
}: Props) {
  const [allLabels,  setAllLabels]  = useState<Label[]>([]);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [newName,    setNewName]     = useState('');
  const [creating,   setCreating]   = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [errMsg,     setErrMsg]     = useState('');

  // currentLabels の ID 配列を文字列化してキャッシュキーとして使う
  const currentKey = currentLabels.map((l) => l.id).sort().join(',');

  useEffect(() => {
    if (!visible) return;
    onFetchLabels()
      .then((ls) => {
        setAllLabels(ls);
        setSelected(new Set(currentLabels.map((l) => l.id)));
      })
      .catch(() => setErrMsg('ラベルを読み込めませんでした'));
  }, [visible, currentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── ラベル ON/OFF ────────────────────────────────────────────────────────
  const toggle = async (labelId: number) => {
    if (togglingId !== null) return; // 連打ガード
    setTogglingId(labelId);
    const attached = selected.has(labelId);
    try {
      await onToggleLabel(labelId, attached);
      setSelected((s) => {
        const next = new Set(s);
        attached ? next.delete(labelId) : next.add(labelId);
        return next;
      });
    } catch {
      setErrMsg('ラベルの変更に失敗しました');
    } finally {
      setTogglingId(null);
    }
  };

  // ─── 新規ラベル作成 ───────────────────────────────────────────────────────
  const createLabel = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const label = await onCreateLabel(name);
      setAllLabels((ls) => [...ls, label]);
      setSelected((s) => new Set([...s, label.id]));
      setNewName('');
    } catch {
      setErrMsg('ラベルの作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const filtered = allLabels.filter(
    (l) => !newName.trim() || l.name.includes(newName.trim()),
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        onRequestClose={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <Text variant="titleSmall" style={styles.title}>ラベル</Text>

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
            <Button compact loading={creating} onPress={createLabel}>
              作成
            </Button>
          )}
        </View>

        <Divider style={{ marginVertical: spacing.sm }} />

        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          style={{ maxHeight: 300 }}
          renderItem={({ item }) => {
            const isToggling = togglingId === item.id;
            return (
              <TouchableOpacity
                style={[styles.row, isToggling && styles.rowDisabled]}
                onPress={() => toggle(item.id)}
                disabled={togglingId !== null}
              >
                <Checkbox
                  status={selected.has(item.id) ? 'checked' : 'unchecked'}
                  onPress={() => toggle(item.id)}
                  disabled={togglingId !== null}
                />
                <Text variant="bodyMedium">{item.name}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text variant="bodySmall" style={styles.empty}>
              {newName.trim() ? '「作成」で新規ラベルを追加' : 'ラベルがありません'}
            </Text>
          }
        />
      </Modal>

      <Snackbar
        visible={!!errMsg}
        onDismiss={() => setErrMsg('')}
        duration={3000}
      >
        {errMsg}
      </Snackbar>
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
  title:    { marginBottom: spacing.sm },
  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    borderWidth:       1,
    borderColor:       '#ddd',
    borderRadius:      8,
    paddingHorizontal: spacing.sm,
  },
  input: {
    flex:      1,
    height:    44,
    fontSize:  14,
    color:     '#333',
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 4,
    minHeight:       44,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  empty: {
    color:     '#aaa',
    textAlign: 'center',
    padding:   spacing.md,
  },
});
