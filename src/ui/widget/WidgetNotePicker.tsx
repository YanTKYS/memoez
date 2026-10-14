import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Snackbar, Text, useTheme } from 'react-native-paper';
import type { Note } from '@/domain/entities/Note';
import { widgetBridge } from '@/lib/widget/widgetBridge';
import { buildWidgetSnapshot } from '@/lib/widget/widgetSnapshot';
import { NoteCard } from '@/ui/components/NoteCard';
import { EmptyState } from '@/ui/components/common/EmptyState';
import { useNotes } from '@/ui/hooks/useNotes';
import { spacing } from '@/ui/theme/spacing';
import { FloatingWindow } from './FloatingWindow';
import { closeWidgetWindow } from './closeWidgetWindow';

interface Props {
  appWidgetId: number;
}

/** ウィジェットの配置時・選び直し時に、表示するメモを選ぶ */
export function WidgetNotePicker({ appWidgetId }: Props) {
  const theme = useTheme();
  const { notes, loading, error, refresh } = useNotes(false);
  const [saving,  setSaving]  = useState(false);
  const [snackMsg, setSnackMsg] = useState('');

  const select = useCallback(async (note: Note) => {
    if (saving) return;
    setSaving(true);
    try {
      // 成功するとネイティブ側でウィンドウが閉じる
      await widgetBridge.completeConfiguration(appWidgetId, buildWidgetSnapshot(note.id, note));
    } catch (e) {
      console.error('widget configuration error:', e);
      setSnackMsg('ウィジェットを設定できませんでした');
      setSaving(false);
    }
  }, [appWidgetId, saving]);

  let content: React.ReactNode;
  if (loading && notes.length === 0) {
    content = <View style={styles.center}><ActivityIndicator /></View>;
  } else if (error) {
    content = (
      <EmptyState
        icon="alert-circle-outline"
        title="読み込みエラー"
        message={error}
        action={{ label: 'リトライ', onPress: refresh }}
      />
    );
  } else if (notes.length === 0) {
    content = (
      <EmptyState
        icon="note-outline"
        title="メモがありません"
        message="MemoEZ でメモを作成してから、もう一度ウィジェットを追加してください"
      />
    );
  } else {
    content = (
      <FlatList
        data={notes}
        keyExtractor={(note) => String(note.id)}
        renderItem={({ item }) => <NoteCard note={item} onPress={select} isGrid={false} />}
        contentContainerStyle={styles.list}
      />
    );
  }

  return (
    <FloatingWindow onRequestClose={closeWidgetWindow}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header elevated={false} statusBarHeight={0}>
          <Appbar.Action icon="close" accessibilityLabel="閉じる" onPress={closeWidgetWindow} />
          <Appbar.Content title="表示するメモを選択" titleStyle={styles.title} />
          {saving && <ActivityIndicator size="small" style={styles.spinner} />}
        </Appbar.Header>
        <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
          選んだメモがホーム画面に付箋として表示されます。
        </Text>
        {content}
        <Snackbar visible={!!snackMsg} onDismiss={() => setSnackMsg('')} duration={2500}>
          {snackMsg}
        </Snackbar>
      </View>
    </FloatingWindow>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 18 },
  spinner:   { marginRight: spacing.md },
  hint:      { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  list:      { paddingBottom: spacing.md },
});
