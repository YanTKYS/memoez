import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { spacing } from '@/ui/theme/spacing';
import type { useGoogleDriveBackup } from '@/ui/hooks/useGoogleDriveBackup';
import { formatDueDateTime } from '@/lib/dateUtils';

interface Props {
  drive: ReturnType<typeof useGoogleDriveBackup>;
  /** 端末側の操作中など、他の処理が走っている間は操作を止める */
  disabled?: boolean;
}

export function GoogleDriveSection({ drive, disabled = false }: Props) {
  const theme = useTheme();
  const locked = drive.busy !== null || disabled;
  const muted = { color: theme.colors.onSurfaceVariant };

  return (
    <View style={styles.section}>
      <Text variant="titleMedium">Google Drive</Text>

      {!drive.configured ? (
        <Text variant="bodySmall" style={muted}>
          このアプリでは Google Drive バックアップを利用できません。
        </Text>
      ) : drive.email === null ? (
        <>
          <Text variant="bodyMedium">Googleアカウント: 未接続</Text>
          <Text variant="bodySmall" style={muted}>
            バックアップはアプリ専用の領域に保存され、マイドライブには表示されません。
          </Text>
          <Button mode="contained" icon="google" onPress={drive.connect} loading={drive.busy === 'connect'} disabled={locked}>
            Googleアカウントに接続
          </Button>
        </>
      ) : (
        <>
          <Text variant="bodyMedium">Googleアカウント: {drive.email}</Text>
          <Text variant="bodyMedium">
            最終バックアップ: {drive.lastBackupAt ? formatDueDateTime(drive.lastBackupAt) : 'なし'}
          </Text>
          <Button
              mode="contained"
              icon="cloud-upload-outline"
              onPress={drive.backup}
              loading={drive.busy === 'backup'}
              disabled={locked}
            >
              Driveへバックアップ
            </Button>
            <Button
              mode="contained-tonal"
              icon="cloud-download-outline"
              onPress={drive.restore}
              loading={drive.busy === 'restore'}
              disabled={locked}
            >
              Driveから復元
            </Button>
          <Button mode="text" onPress={drive.disconnect} loading={drive.busy === 'disconnect'} disabled={locked}>
            Googleアカウントの接続解除
          </Button>
        </>
      )}

      {drive.result && (
        <Text
          variant="bodyMedium"
          accessibilityLiveRegion="polite"
          style={{ color: drive.result.ok ? theme.colors.primary : theme.colors.error }}
        >
          {drive.result.ok ? '✓ ' : '✗ '}
          {drive.result.text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
