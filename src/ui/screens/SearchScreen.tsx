import React, { useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TextInput as RNTextInput,
} from 'react-native';
import { Appbar, Text, ActivityIndicator, useTheme } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoteCard } from '@/ui/components/NoteCard';
import { EmptyState } from '@/ui/components/common/EmptyState';
import { useSearch } from '@/ui/hooks/useSearch';
import { spacing } from '@/ui/theme/spacing';
import type { Note } from '@/domain/entities/Note';

export function SearchScreen() {
  const router          = useRouter();
  const theme           = useTheme();
  const inputRef        = useRef<RNTextInput>(null);
  const { query, setQuery, results, loading } = useSearch();

  useFocusEffect(
    useCallback(() => {
      inputRef.current?.focus();
    }, []),
  );

  const openNote = useCallback((note: Note) => router.push(`/note/${note.id}`), [router]);

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
        {query.length > 0 && (
          <Appbar.Action icon="close" onPress={() => setQuery('')} />
        )}
      </Appbar.Header>

      {!query.trim() ? (
        <EmptyState
          icon="magnify"
          title="メモを検索"
          message="キーワードを入力するとタイトル・本文・チェックリストを検索します"
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
              {results.length}件見つかりました
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
  resultCount: {
    marginBottom: spacing.sm,
  },
});
