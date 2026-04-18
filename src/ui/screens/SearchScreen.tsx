import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TextInput as RNTextInput,
  ScrollView,
} from 'react-native';
import { Appbar, Text, ActivityIndicator, Chip, useTheme } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoteCard } from '@/ui/components/NoteCard';
import { EmptyState } from '@/ui/components/common/EmptyState';
import { useSearch } from '@/ui/hooks/useSearch';
import { spacing } from '@/ui/theme/spacing';
import type { Note } from '@/domain/entities/Note';
import type { Label } from '@/domain/entities/Label';
import { getLabelRepository } from '@/lib/di';

export function SearchScreen() {
  const router          = useRouter();
  const theme           = useTheme();
  const inputRef        = useRef<RNTextInput>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const { query, setQuery, results, loading } = useSearch(selectedLabelId);

  useFocusEffect(
    useCallback(() => {
      inputRef.current?.focus();
      getLabelRepository().findAll()
        .then(setLabels)
        .catch(() => setLabels([]));
    }, []),
  );

  const openNote = useCallback((note: Note) => router.push(`/note/${note.id}`), [router]);
  const hasFilter = selectedLabelId !== null;
  const selectedLabel = labels.find((l) => l.id === selectedLabelId);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <RNTextInput
          ref={inputRef}
          style={[styles.searchInput, { color: theme.colors.onSurface }]}
          placeholder="検索..."
          placeholderTextColor={theme.colors.onSurfaceDisabled}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {hasFilter && (
          <Appbar.Action icon="filter-remove-outline" onPress={() => setSelectedLabelId(null)} />
        )}
        {query.length > 0 && (
          <Appbar.Action icon="close" onPress={() => setQuery('')} />
        )}
      </Appbar.Header>

      <ScrollView
        horizontal
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
        showsHorizontalScrollIndicator={false}
      >
        {labels.map((label) => (
          <Chip
            key={label.id}
            selected={selectedLabelId === label.id}
            onPress={() => setSelectedLabelId((prev) => prev === label.id ? null : label.id)}
            compact
            style={styles.filterChip}
          >
            {label.name}
          </Chip>
        ))}
      </ScrollView>

      {!query.trim() && !hasFilter ? (
        <EmptyState
          icon="magnify"
          title="メモを検索"
          message="キーワードまたはラベルでメモを検索できます"
        />
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : results.length === 0 ? (
        <EmptyState
          icon="note-search-outline"
          title={`"${query}" は見つかりませんでした`}
          message="別のキーワードで試してみてください"
        />
      ) : (
        <FlatList
          key={query}
          data={results}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <NoteCard note={item} onPress={openNote} isGrid={false} />
          )}
          ListHeaderComponent={
            <Text variant="labelSmall" style={[styles.resultCount, { color: theme.colors.onSurfaceVariant }]}>
              {selectedLabel ? `ラベル: ${selectedLabel.name} / ` : ''}{results.length}件見つかりました
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex:     1,
    fontSize: 16,
    height:   '100%',
  },
  list: {
    padding:       spacing.md,
    paddingBottom: 40,
  },
  filterBar: {
    maxHeight: 44,
  },
  filterBarContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  filterChip: {
    alignSelf: 'center',
  },
  resultCount: {
    marginBottom: spacing.sm,
  },
});
