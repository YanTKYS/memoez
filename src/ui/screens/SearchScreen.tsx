import React, { useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TextInput as RNTextInput,
} from 'react-native';
import { Appbar, Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoteCard } from '@/ui/components/NoteCard';
import { EmptyState } from '@/ui/components/common/EmptyState';
import { useSearch } from '@/ui/hooks/useSearch';
import { spacing } from '@/ui/theme/spacing';
import type { Note } from '@/domain/entities/Note';

export function SearchScreen() {
  const router          = useRouter();
  const inputRef        = useRef<RNTextInput>(null);
  const { query, setQuery, results, loading } = useSearch();

  useEffect(() => {
    // 画面表示後にフォーカス
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const openNote = (note: Note) => router.push(`/note/${note.id}`);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* SearchAppBar */}
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <RNTextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="検索..."
          placeholderTextColor="#aaa"
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

      {/* コンテンツ */}
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
          data={results}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <NoteCard note={item} onPress={() => openNote(item)} isGrid={false} />
          )}
          ListHeaderComponent={
            <Text variant="labelSmall" style={styles.resultCount}>
              {results.length}件見つかりました
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex:      1,
    fontSize:  16,
    color:     '#1a1a1a',
    height:    '100%',
  },
  list: {
    padding:      spacing.md,
    paddingBottom: 40,
  },
  resultCount: {
    color:        '#888',
    marginBottom: spacing.sm,
  },
});
