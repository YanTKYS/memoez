import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View, useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { startWidgetSync } from '@/lib/widget/widgetSync';
import { EmptyState } from '@/ui/components/common/EmptyState';
import { useDatabaseInit } from '@/ui/hooks/useDatabaseInit';
import { memoEZDarkTheme, memoEZTheme } from '@/ui/theme/theme';
import { FloatingNoteEditor } from './FloatingNoteEditor';
import { FloatingWindow } from './FloatingWindow';
import { WidgetNotePicker } from './WidgetNotePicker';
import { closeWidgetWindow } from './closeWidgetWindow';

/** ネイティブ側（MemoEZWindowActivity）が表示するコンポーネント名。index.ts で登録する */
export const WIDGET_WINDOW_COMPONENT = 'MemoEZWidgetWindow';

/** ネイティブ側から渡される初期 props（FloatingEditorActivity / WidgetConfigActivity） */
export interface WidgetWindowProps {
  mode?:        'edit' | 'configure';
  noteId?:      number;
  appWidgetId?: number;
}

/**
 * ホーム画面ウィジェットから開くウィンドウのルート。
 * 通常画面（Expo Router）とは別のルートだが、同じ JS ランタイム・同じ DB 接続を使う。
 */
export function WidgetWindowRoot({ mode = 'edit', noteId = 0, appWidgetId = 0 }: WidgetWindowProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? memoEZDarkTheme : memoEZTheme;
  const { dbState, errMsg, retry } = useDatabaseInit();

  useEffect(() => {
    if (dbState === 'ready') startWidgetSync();
  }, [dbState]);

  const showsEditor = dbState === 'ready' && mode === 'edit' && noteId > 0;

  // 戻る操作: 編集画面が表示されていればそちら（保存してから閉じる）に任せ、
  // それ以外（読み込み中・メモ選択・エラー表示）はこのウィンドウを閉じる。
  const showsEditorRef = useRef(showsEditor);
  showsEditorRef.current = showsEditor;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showsEditorRef.current) return false;
      closeWidgetWindow();
      return true;
    });
    return () => sub.remove();
  }, []);

  let content: React.ReactNode;
  if (dbState !== 'ready') {
    content = (
      <FloatingWindow onRequestClose={closeWidgetWindow}>
        {dbState === 'loading' ? (
          <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <EmptyState
            icon="alert-circle-outline"
            title="データベースを開けませんでした"
            message={errMsg}
            action={{ label: '再試行', onPress: retry }}
          />
        )}
      </FloatingWindow>
    );
  } else if (mode === 'configure') {
    content = <WidgetNotePicker appWidgetId={appWidgetId} />;
  } else if (showsEditor) {
    content = <FloatingNoteEditor noteId={noteId} />;
  } else {
    content = (
      <FloatingWindow onRequestClose={closeWidgetWindow}>
        <EmptyState
          icon="alert-circle-outline"
          title="メモを開けませんでした"
          message="ウィジェットを長押しして、表示するメモを選び直してください"
          action={{ label: '閉じる', onPress: closeWidgetWindow }}
        />
      </FloatingWindow>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        {content}
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
