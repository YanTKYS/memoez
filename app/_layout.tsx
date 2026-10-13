import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { memoEZTheme, memoEZDarkTheme } from '@/ui/theme/theme';
import { useDatabaseInit } from '@/ui/hooks/useDatabaseInit';
import { startWidgetSync } from '@/lib/widget/widgetSync';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';

export default function RootLayout() {
  const { dbState, errMsg, retry } = useDatabaseInit();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? memoEZDarkTheme : memoEZTheme;

  // ホーム画面ウィジェットの表示をメモの変更に追従させる（ウィジェット未配置なら何もしない）
  useEffect(() => {
    if (dbState === 'ready') startWidgetSync();
  }, [dbState]);

  if (dbState === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (dbState === 'error') {
    return (
      <View style={styles.center}>
        <Text variant="titleMedium" style={styles.errTitle}>
          データベースを開けませんでした
        </Text>
        <Text variant="bodySmall" style={[styles.errDetail, { color: theme.colors.onSurfaceVariant }]}>{errMsg}</Text>
        <Button mode="contained" onPress={retry} style={styles.retryBtn}>
          再試行
        </Button>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }} />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errTitle:  { marginBottom: 8, textAlign: 'center' },
  errDetail: { textAlign: 'center', marginBottom: 24 },
  retryBtn:  { minWidth: 120 },
});
