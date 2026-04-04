import React, { useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { Appbar, FAB, Text, ActivityIndicator } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoteCard } from '@/ui/components/NoteCard';
import { EmptyState } from '@/ui/components/common/EmptyState';
import { useNotes } from '@/ui/hooks/useNotes';
import { useSettingsStore } from '@/store/settingsStore';
import type { Note } from '@/domain/entities/Note';
import { spacing } from '@/ui/theme/spacing';

export function HomeScreen() {
  const router       = useRouter();
  const { width }    = useWindowDimensions();
  const layoutMode   = useSettingsStore((s) => s.layoutMode);
  const toggleLayout = useSettingsStore((s) => s.toggleLayout);
  const { notes, loading, error, refresh } = useNotes(false);

  useFocusEffect(
    useCallback(() => { refresh(); }, [refresh]),
  );

  // ★ useMemo で安定した参照を確保 → listItems の useMemo が正しく動く
  const pinned = useMemo(() => notes.filter((n) => n.isPinned),  [notes]);
  const regular = useMemo(() => notes.filter((n) => !n.isPinned), [notes]);

  // ★ useCallback で安定した関数参照 → NoteCard の React.memo が正しく機能する
  const openNote = useCallback((note: Note) => router.push(`/note/${note.id}`), [router]);
  const newNote  = useCallback(() => router.push('/note/new'), [router]);

  const isGrid   = layoutMode === 'grid';
  const numCols  = isGrid ? (width >= 600 ? 3 : 2) : 1;
  const colGap   = spacing.sm;
  const cardWidth = isGrid
    ? (width - spacing.md * 2 - colGap * (numCols - 1)) / numCols
    : undefined;

  type SectionItem =
    | { kind: 'header';   label: string }
    | { kind: 'grid-row'; notes: Note[]; rowKey: string }
    | { kind: 'list-item'; note: Note };

  const listItems = useMemo<SectionItem[]>(() => {
    const items: SectionItem[] = [];

    const pushNotes = (noteList: Note[], header: string) => {
      if (noteList.length === 0) return;
      items.push({ kind: 'header', label: header });
      if (isGrid) {
        for (let i = 0; i < noteList.length; i += numCols) {
          const chunk = noteList.slice(i, i + numCols);
          items.push({
            kind:   'grid-row',
            notes:  chunk,
            rowKey: chunk.map((n) => n.id).join('-'),
          });
        }
      } else {
        noteList.forEach((n) => items.push({ kind: 'list-item', note: n }));
      }
    };

    pushNotes(pinned,  'ピン留め');
    pushNotes(regular, 'メモ');
    return items;
  }, [pinned, regular, isGrid, numCols]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.Content title="MemoEZ" />
        <Appbar.Action
          icon={isGrid ? 'view-list' : 'view-grid'}
          onPress={toggleLayout}
        />
        <Appbar.Action
          icon="magnify"
          onPress={() => router.push('/search')}
        />
        <Appbar.Action
          icon="label-outline"
          onPress={() => router.push('/labels')}
        />
      </Appbar.Header>

      {loading && notes.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="読み込みエラー"
          message={error}
        />
      ) : notes.length === 0 ? (
        <EmptyState
          icon="note-outline"
          title="まだメモがありません"
          message="右下の＋ボタンをタップして最初のメモを作成しましょう"
        />
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => {
            if (item.kind === 'header')   return `header-${item.label}`;
            if (item.kind === 'grid-row') return item.rowKey;
            return `note-${item.note.id}`;
          }}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} />
          }
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <Text variant="labelSmall" style={styles.sectionHeader}>
                  {item.label}
                </Text>
              );
            }
            if (item.kind === 'grid-row') {
              return (
                <View style={[styles.gridRow, { gap: colGap }]}>
                  {item.notes.map((note) => (
                    <View key={note.id} style={{ width: cardWidth }}>
                      {/* ★ openNote は stable → NoteCard の React.memo が有効 */}
                      <NoteCard note={note} onPress={openNote} isGrid />
                    </View>
                  ))}
                  {Array.from({ length: numCols - item.notes.length }).map((_, i) => (
                    <View key={`empty-${i}`} style={{ width: cardWidth }} />
                  ))}
                </View>
              );
            }
            return (
              <NoteCard
                note={item.note}
                onPress={openNote}
                isGrid={false}
              />
            );
          }}
        />
      )}

      <FAB
        icon="plus"
        label="メモ"
        style={styles.fab}
        onPress={newNote}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#fff' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:          { paddingHorizontal: spacing.md, paddingBottom: 100 },
  sectionHeader: {
    color:         '#888',
    marginTop:     spacing.md,
    marginBottom:  spacing.xs,
    letterSpacing: 0.8,
  },
  gridRow: { flexDirection: 'row', marginBottom: spacing.sm },
  fab:     { position: 'absolute', right: spacing.md, bottom: spacing.xl },
});
