import React from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { Appbar, Button, Divider, List, ProgressBar, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppUpdate } from '@/ui/hooks/useAppUpdate';
import { RELEASES_PAGE } from '@/lib/updates/updatesBridge';
import { updateStatus } from '@/lib/updates/messages';

export function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const update = useAppUpdate();
  const offer = update.result?.release;
  const locked = update.busy !== null || update.installerOpen;
  const openRelease = () => { void Linking.openURL(update.result?.page ?? RELEASES_PAGE).catch(() => {}); };
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="設定" />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
        <List.Item title="バックアップ" description="JSON の保存・復元／Google Drive" left={(props) => <List.Icon {...props} icon="database-export-outline" />} disabled={locked} onPress={() => { update.discard(); router.push('/backup'); }} />
        <Divider />
        <Text variant="titleMedium" style={styles.heading}>アプリについて／更新</Text>
        <Text>インストール済み: {update.installed ? `${update.installed.versionName}（${update.installed.versionCode}）` : '取得できません'}</Text>
        {update.installed?.debuggable && <Text style={styles.paragraph}>デバッグ版</Text>}
        <Button mode="outlined" disabled={locked || !update.installed} loading={update.busy === 'checking'} onPress={() => { void update.check(); }} style={styles.button}>最新版を確認</Button>
        {update.result && <>
          {update.result.versionName && <Text>最新リリース: {update.result.versionName}{offer ? `（${offer.versionCode}）` : ''}</Text>}
          <Text style={styles.paragraph} accessibilityLiveRegion="polite">{updateStatus(update.result)}</Text>
          {!!offer?.notes && <Text style={styles.notes}>{offer.notes}</Text>}
        </>}
        {update.result?.status === 'available' && !update.ready && !locked && <Button mode="contained" onPress={() => { void update.download(); }} style={styles.button}>更新する（{Math.ceil((offer?.size ?? 0) / 1024 / 1024)} MB）</Button>}
        {update.busy === 'downloading' && <>
          <ProgressBar progress={update.progress ? update.progress.bytes / update.progress.total : 0} />
          <Text style={styles.paragraph} accessibilityLiveRegion="polite">{update.progress?.phase === 'verifying' ? '更新ファイルを検証しています…' : `取得中 ${update.progress ? Math.floor(update.progress.bytes / update.progress.total * 100) : 0}%`}</Text>
          <Button onPress={update.cancel}>取得を中断</Button>
        </>}
        {update.ready && <>
          {!update.permission && <>
            <Text style={styles.paragraph}>更新には、Android の設定で MemoEZ からのアプリのインストールを許可する必要があります。許可後、この画面へ戻ってください。</Text>
            <Button mode="outlined" disabled={locked} onPress={() => { void update.openPermission(); }}>この提供元からのインストール設定</Button>
          </>}
          <Button mode="contained" disabled={locked || !update.permission} loading={update.busy === 'installing'} onPress={() => { void update.install(); }} style={styles.button}>Android の確認画面を開く</Button>
        </>}
        {!!update.message && <Text style={styles.paragraph} accessibilityLiveRegion="polite">{update.message}</Text>}
        <Button onPress={openRelease} style={styles.button}>GitHub Release／リリースノート</Button>
        <Text variant="bodySmall" style={styles.paragraph}>確認と取得は操作したときだけ行います。更新前にバックアップをおすすめします。更新できない場合も、アプリやデータを削除しないでください。</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: 16, gap: 8 }, heading: { marginTop: 16, marginBottom: 8 }, paragraph: { marginVertical: 8 }, button: { marginVertical: 6 }, notes: { marginVertical: 8, lineHeight: 22 } });
