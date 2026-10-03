import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Appbar, Button, Text, Snackbar, SegmentedButtons, useTheme, List, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { spacing } from '@/ui/theme/spacing';
import { getLabelRepository, getNoteRepository } from '@/lib/di';
import { exportBackupJson, importBackupJson, type ImportPolicy } from '@/domain/usecases/backupJson';
import * as FileSystem from 'expo-file-system';
import { GoogleDriveSection } from '@/ui/components/Backup/GoogleDriveSection';
import { useGoogleDriveBackup } from '@/ui/hooks/useGoogleDriveBackup';

export function BackupScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [policy, setPolicy] = useState<ImportPolicy>('merge');
  const [fileBusy, setBusy] = useState(false);
  const [snack, setSnack] = useState('');
  const [directoryUri, setDirectoryUri] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const drive = useGoogleDriveBackup(policy);
  // ファイル操作と Drive 操作が同時に走らないよう、どちらかが実行中なら両方を止める
  const busy = fileBusy || drive.busy !== null;

  const fileNameOf = useCallback((uri: string): string => decodeURIComponent(uri.split('/').pop() ?? uri), []);

  const ensureDirectory = useCallback(async (): Promise<string | null> => {
    if (directoryUri) return directoryUri;

    if (Platform.OS === 'android') {
      const initial = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
      const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initial);
      if (!permission.granted || !permission.directoryUri) return null;
      setDirectoryUri(permission.directoryUri);
      return permission.directoryUri;
    }

    setDirectoryUri(FileSystem.documentDirectory);
    return FileSystem.documentDirectory;
  }, [directoryUri]);

  const refreshFiles = useCallback(async () => {
    const dir = await ensureDirectory();
    if (!dir) return;

    const isSaf = dir.startsWith('content://');
    const uris = isSaf
      ? await FileSystem.StorageAccessFramework.readDirectoryAsync(dir)
      : (await FileSystem.readDirectoryAsync(dir)).map((name) => `${dir}${name}`);

    const jsonFiles = uris
      .filter((uri) => fileNameOf(uri).startsWith('memoez-backup-') && fileNameOf(uri).endsWith('.json'))
      .sort()
      .reverse();

    setFiles(jsonFiles);
    // 選択済みのファイルが残っていればそのまま。無ければ最新のものを選ぶ
    setSelectedFile((prev) => (prev && jsonFiles.includes(prev) ? prev : jsonFiles[0] ?? null));
  }, [ensureDirectory, fileNameOf]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const handleChooseDirectory = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setSnack('iOSではアプリ領域(documentDirectory)を使用します');
      return;
    }
    const initial = directoryUri ?? FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initial);
    if (!permission.granted || !permission.directoryUri) {
      setSnack('フォルダ選択がキャンセルされました');
      return;
    }
    setDirectoryUri(permission.directoryUri);
    setSelectedFile(null);
    setSnack('保存先/読込先を更新しました');
  }, [directoryUri]);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const json = await exportBackupJson(getNoteRepository());
      const dir = await ensureDirectory();
      if (!dir) throw new Error('保存先フォルダが未選択です');

      let outputUri = '';
      if (dir.startsWith('content://')) {
        outputUri = await FileSystem.StorageAccessFramework.createFileAsync(
          dir,
          `memoez-backup-${Date.now()}`,
          'application/json',
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(outputUri, json);
      } else {
        outputUri = `${dir}memoez-backup-${Date.now()}.json`;
        await FileSystem.writeAsStringAsync(outputUri, json);
      }

      setSnack(`エクスポート完了: ${fileNameOf(outputUri)}`);
      await refreshFiles();
    } catch (e) {
      console.error(e);
      setSnack('エクスポートに失敗しました');
    } finally {
      setBusy(false);
    }
  }, [ensureDirectory, fileNameOf, refreshFiles]);

  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      setSnack('インポート対象ファイルを選択してください');
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
                await FileSystem.readAsStringAsync(selectedFile),
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
  }, [policy, selectedFile]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="バックアップ" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text variant="titleMedium">復元方法</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            JSONファイル・Google Drive どちらから復元する場合も共通です。
            merge は同じ内容のメモを除いて追加、overwrite は現在のメモを削除してバックアップに置き換えます。
          </Text>
          <SegmentedButtons
            value={policy}
            onValueChange={(v) => setPolicy(v as ImportPolicy)}
            buttons={[
              { value: 'merge', label: 'merge' },
              { value: 'overwrite', label: 'overwrite' },
            ]}
          />
        </View>

        <Divider />

        <View style={styles.section}>
          <Text variant="titleMedium">端末</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            初期値は Download フォルダです。保存先/読込先を変更できます。
          </Text>

          <Button mode="outlined" onPress={handleChooseDirectory} disabled={busy}>
            保存先/読込先を選択
          </Button>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            現在の場所: {directoryUri ?? '(未選択)'}
          </Text>

          <Button mode="contained-tonal" onPress={handleExport} loading={fileBusy} disabled={busy}>
            JSONファイルへバックアップ
          </Button>
          <Button mode="contained" onPress={handleImport} loading={fileBusy} disabled={busy}>
            JSONファイルから復元
          </Button>

          <Button mode="outlined" onPress={refreshFiles} disabled={busy}>
            ファイル一覧を更新
          </Button>

          <View style={[styles.fileBox, { borderColor: theme.colors.outlineVariant }]}>
            {files.length === 0 ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                backup ファイルがありません。先にバックアップしてください。
              </Text>
            ) : (
              files.map((uri) => {
                const selected = selectedFile === uri;
                return (
                  <List.Item
                    key={uri}
                    title={fileNameOf(uri)}
                    description={selected ? '選択中' : undefined}
                    onPress={() => setSelectedFile(uri)}
                    left={(props) => (
                      <List.Icon
                        {...props}
                        icon={selected ? 'check-circle' : 'file-document-outline'}
                      />
                    )}
                  />
                );
              })
            )}
          </View>
        </View>

        <Divider />

        <GoogleDriveSection drive={drive} disabled={fileBusy} />
      </ScrollView>

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={2200}>
        {snack}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  section: { gap: spacing.sm },
  fileBox: {
    minHeight: 160,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
