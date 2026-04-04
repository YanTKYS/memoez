import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TextInput as RNTextInput,
  Alert,
} from 'react-native';
import {
  Appbar,
  Text,
  IconButton,
  Divider,
  ActivityIndicator,
  FAB,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Label } from '@/domain/entities/Label';
import { getLabelRepository } from '@/lib/di';
import { EmptyState } from '@/ui/components/common/EmptyState';
import { spacing } from '@/ui/theme/spacing';

export function LabelManagerScreen() {
  const router             = useRouter();
  const [labels, setLabels]       = useState<Label[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText]   = useState('');
  const [newName, setNewName]     = useState('');
  const [showNew, setShowNew]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const repo = getLabelRepository();
      setLabels(await repo.findAll());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEdit = (label: Label) => {
    setEditingId(label.id);
    setEditText(label.name);
  };

  const commitEdit = async () => {
    if (!editingId || !editText.trim()) { setEditingId(null); return; }
    await getLabelRepository().update(editingId, editText.trim());
    setEditingId(null);
    load();
  };

  const deleteLabel = (label: Label) => {
    Alert.alert(
      'ラベルを削除',
      `"${label.name}" を削除しますか？\nこのラベルが付いたメモからも外れます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await getLabelRepository().delete(label.id);
            load();
          },
        },
      ],
    );
  };

  const createLabel = async () => {
    const name = newName.trim();
    if (!name) return;
    await getLabelRepository().create(name);
    setNewName('');
    setShowNew(false);
    load();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="ラベルを編集" />
      </Appbar.Header>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={labels}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            showNew ? (
              <View style={styles.newRow}>
                <MaterialCommunityIcons name="label-outline" size={20} color="#888" />
                <RNTextInput
                  style={styles.input}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="新しいラベル名"
                  placeholderTextColor="#bbb"
                  autoFocus
                  onSubmitEditing={createLabel}
                  returnKeyType="done"
                />
                <IconButton icon="check" size={20} onPress={createLabel} />
                <IconButton icon="close" size={20} onPress={() => setShowNew(false)} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !showNew ? (
              <EmptyState
                icon="label-outline"
                title="ラベルがありません"
                message="＋ボタンで最初のラベルを作成しましょう"
              />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <MaterialCommunityIcons name="label-outline" size={20} color="#888" />
              {editingId === item.id ? (
                <RNTextInput
                  style={styles.input}
                  value={editText}
                  onChangeText={setEditText}
                  autoFocus
                  onSubmitEditing={commitEdit}
                  returnKeyType="done"
                />
              ) : (
                <Text variant="bodyMedium" style={styles.labelName}>{item.name}</Text>
              )}
              {editingId === item.id ? (
                <>
                  <IconButton icon="check" size={20} onPress={commitEdit} />
                  <IconButton icon="close" size={20} onPress={() => setEditingId(null)} />
                </>
              ) : (
                <>
                  <IconButton icon="pencil-outline" size={20} onPress={() => startEdit(item)} />
                  <IconButton icon="delete-outline" size={20} onPress={() => deleteLabel(item)} />
                </>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <Divider />}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowNew(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingLeft:   spacing.md,
    paddingVertical: 2,
  },
  newRow: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingLeft:   spacing.md,
    paddingVertical: 2,
    backgroundColor: '#f9f9f9',
  },
  labelName: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  input: {
    flex:      1,
    fontSize:  15,
    color:     '#333',
    marginLeft: spacing.sm,
    height:    44,
  },
  fab: {
    position: 'absolute',
    right:    spacing.md,
    bottom:   spacing.xl,
  },
});
