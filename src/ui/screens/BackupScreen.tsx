import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { Appbar, Button, Text, Snackbar, SegmentedButtons, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { spacing } from '@/ui/theme/spacing';
import { getLabelRepository, getNoteRepository } from '@/lib/di';
import { exportBackupJson, importBackupJson, type ImportPolicy } from '@/domain/usecases/backupJson';

export function BackupScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [jsonText, setJsonText] = useState('');
  const [policy, setPolicy] = useState<ImportPolicy>('merge');
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState('');

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const json = await exportBackupJson(getNoteRepository());
      setJsonText(json);
      setSnack('エクスポートJSONを生成しました');
    } catch (e) {
      console.error(e);
      setSnack('エクスポートに失敗しました');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (jsonText.trim() === '') {
      setSnack('インポートJSONが空です');
      return;
    }
    Alert.alert(
      'インポート実行',
      policy === 'overwrite'
        ? '既存ノートを上書き（論理削除）してインポートします。続行しますか？'
        : 'マージモードでインポートします。続行しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '実行',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const result = await importBackupJson(
                jsonText,
                { noteRepo: getNoteRepository(), labelRepo: getLabelRepository() },
                policy,
              );
              setSnack(`インポート完了: 作成 ${result.created}件 / スキップ ${result.skipped}件`);
            } catch (e) {
              console.error(e);
              setSnack((e as Error).message || 'インポートに失敗しました');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [jsonText, policy]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="バックアップ I/O" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleMedium">JSON Export / Import</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          実機確認用: エクスポート結果を編集してそのままインポートできます。
        </Text>

        <View style={styles.row}>
          <Button mode="contained-tonal" onPress={handleExport} loading={busy} disabled={busy}>
            エクスポート
          </Button>
          <Button mode="contained" onPress={handleImport} loading={busy} disabled={busy}>
            インポート
          </Button>
        </View>

        <SegmentedButtons
          value={policy}
          onValueChange={(v) => setPolicy(v as ImportPolicy)}
          buttons={[
            { value: 'merge', label: 'merge' },
            { value: 'overwrite', label: 'overwrite' },
          ]}
        />

        <TextInput
          style={[styles.input, { color: theme.colors.onSurface, borderColor: theme.colors.outlineVariant }]}
          multiline
          value={jsonText}
          onChangeText={setJsonText}
          placeholder='{"version":"1.0","notes":[]}'
          placeholderTextColor={theme.colors.onSurfaceDisabled}
        />
      </ScrollView>

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={2200}>
        {snack}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    minHeight: 280,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    textAlignVertical: 'top',
    fontSize: 13,
  },
});

