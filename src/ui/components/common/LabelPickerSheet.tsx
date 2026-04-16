import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Portal, Modal, Checkbox, Divider, Button, Snackbar, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Label } from '@/domain/entities/Label';
import { spacing } from '@/ui/theme/spacing';

interface Props {
  visible:        boolean;
  currentLabels:  Label[];
  onDismiss:      () => void;
  /** ラベル一覧を取得する（DB 操作は呼び出し元が担う） */
  onFetchLabels:  () => Promise<Label[]>;
  /** ラベルのアタッチ/デタッチを切り替える（呼び出し元で楽観的更新済み） */
  onToggleLabel:  (label: Label, currentlyAttached: boolean) => Promise<void>;
  /** ラベル管理画面を開く（作成/編集は管理画面で実施） */
  onOpenLabelManager: () => void;
}

export function LabelPickerSheet({
  visible, currentLabels, onDismiss,
  onFetchLabels, onToggleLabel, onOpenLabelManager,
}: Props) {
  const theme = useTheme();
  const [allLabels,  setAllLabels]  = useState<Label[]>([]);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [errMsg,     setErrMsg]     = useState('');

  // シート表示時のみラベル一覧を取得。開いている間の currentLabels 変更は
  // selected / allLabels をローカルで管理するため再取得しない。
  useEffect(() => {
    if (!visible) return;
    onFetchLabels()
      .then((ls) => {
        setAllLabels(ls);
        setSelected(new Set(currentLabels.map((l) => l.id)));
      })
      .catch(() => setErrMsg('ラベルを読み込めませんでした'));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── ラベル ON/OFF ────────────────────────────────────────────────────────
  const toggle = async (item: Label) => {
    if (togglingId !== null) return; // 連打ガード
    setTogglingId(item.id);
    const attached = selected.has(item.id);
    try {
      await onToggleLabel(item, attached);
      setSelected((s) => {
        const next = new Set(s);
        if (attached) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
    } catch {
      setErrMsg('ラベルの変更に失敗しました');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text variant="titleSmall" style={styles.title}>ラベル</Text>
        <View style={styles.manageRow}>
          <MaterialCommunityIcons name="information-outline" size={16} color={theme.colors.onSurfaceVariant} />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            ラベルの作成/編集はラベル管理画面で行ってください
          </Text>
        </View>
        <View style={styles.manageButtonRow}>
          <Button mode="outlined" onPress={onOpenLabelManager}>
            ラベル管理画面へ
          </Button>
        </View>

        <Divider style={{ marginVertical: spacing.sm }} />

        <FlatList
          data={allLabels}
          keyExtractor={(item) => String(item.id)}
          style={{ maxHeight: 300 }}
          renderItem={({ item }) => {
            const isToggling = togglingId === item.id;
            return (
              <TouchableOpacity
                style={[styles.row, isToggling && styles.rowDisabled]}
                onPress={() => toggle(item)}
                disabled={togglingId !== null}
              >
                <Checkbox
                  status={selected.has(item.id) ? 'checked' : 'unchecked'}
                  onPress={() => toggle(item)}
                  disabled={togglingId !== null}
                />
                <Text variant="bodyMedium">{item.name}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text variant="bodySmall" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
              {'ラベルがありません'}
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
    margin:       spacing.xl,
    borderRadius: 16,
    padding:      spacing.md,
  },
  title:    { marginBottom: spacing.sm },
  manageRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
  },
  manageButtonRow: {
    marginTop: spacing.xs,
    alignItems: 'flex-start',
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
    textAlign: 'center',
    padding:   spacing.md,
  },
});
