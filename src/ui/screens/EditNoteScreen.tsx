import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import {
  Appbar,
  Text,
  IconButton,
  Divider,
  ActivityIndicator,
  Snackbar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NOTE_COLOR_LIGHT } from '@/ui/theme/colors';
import { spacing } from '@/ui/theme/spacing';
import { useEditNote } from '@/ui/hooks/useEditNote';
import { ColorPicker } from '@/ui/components/common/ColorPicker';
import { LabelPickerSheet } from '@/ui/components/common/LabelPickerSheet';
import { formatRelativeTime } from '@/lib/dateUtils';

interface Props {
  noteId?: number;
}

export function EditNoteScreen({ noteId }: Props) {
  const [showColor,  setShowColor]  = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  const {
    note,
    loading,
    saving,
    snackMsg,
    setSnackMsg,
    form,
    setTitle,
    setContent,
    setType,
    setColor,
    addChecklistItem,
    updateChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    lastAddedKey,
    handleBack,
    handleDelete,
    handlePin,
    handleLabelChanged,
    prepareForLabels,
  } = useEditNote(noteId);

  // ─── Android ハードウェアバックボタン ─────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  // ─── ラベルボタン ─────────────────────────────────────────────────────
  const handleLabelPress = useCallback(async () => {
    const ok = await prepareForLabels();
    if (ok) setShowLabels(true);
  }, [prepareForLabels]);

  const bgColor = NOTE_COLOR_LIGHT[form.color];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Appbar.Header style={{ backgroundColor: bgColor }} elevated={false}>
          <Appbar.BackAction onPress={handleBack} />
          <Appbar.Content title="" />
          <Appbar.Action
            icon={note?.isPinned ? 'pin' : 'pin-outline'}
            onPress={handlePin}
          />
          {note && (
            <Appbar.Action icon="delete-outline" onPress={handleDelete} />
          )}
          {saving && <ActivityIndicator size="small" style={{ marginRight: 8 }} />}
        </Appbar.Header>

        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <TextInput
            style={styles.titleInput}
            placeholder="タイトル"
            placeholderTextColor="#aaa"
            value={form.title}
            onChangeText={setTitle}
            multiline={false}
            returnKeyType="next"
          />

          <Divider style={styles.divider} />

          {form.type === 'TEXT' && (
            <TextInput
              style={styles.contentInput}
              placeholder="メモを入力..."
              placeholderTextColor="#aaa"
              value={form.content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
          )}

          {form.type === 'CHECKLIST' && (
            <View style={styles.checklist}>
              {form.checklistItems
                .filter((i) => !i.isChecked)
                .map((item) => (
                  <ChecklistRow
                    key={item.key}
                    itemKey={item.key}
                    text={item.text}
                    isChecked={item.isChecked}
                    onChangeText={updateChecklistItem}
                    onToggle={toggleChecklistItem}
                    onRemove={removeChecklistItem}
                    autoFocus={item.key === lastAddedKey}
                  />
                ))}
              <TouchableOpacity
                style={styles.addItem}
                onPress={addChecklistItem}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="plus" size={18} color="#888" />
                <Text variant="bodyMedium" style={{ color: '#888' }}>アイテムを追加</Text>
              </TouchableOpacity>

              {form.checklistItems.some((i) => i.isChecked) && (
                <>
                  <Divider style={styles.divider} />
                  <Text variant="labelSmall" style={styles.doneLabel}>
                    チェック済み ({form.checklistItems.filter((i) => i.isChecked).length})
                  </Text>
                  {form.checklistItems
                    .filter((i) => i.isChecked)
                    .map((item) => (
                      <ChecklistRow
                        key={item.key}
                        itemKey={item.key}
                        text={item.text}
                        isChecked={item.isChecked}
                        onChangeText={updateChecklistItem}
                        onToggle={toggleChecklistItem}
                        onRemove={removeChecklistItem}
                        done
                      />
                    ))}
                </>
              )}
            </View>
          )}
        </ScrollView>

        <View style={[styles.bottomBar, { backgroundColor: bgColor }]}>
          <IconButton
            icon={form.type === 'TEXT' ? 'checkbox-marked-outline' : 'text'}
            size={22}
            onPress={() => setType(form.type === 'TEXT' ? 'CHECKLIST' : 'TEXT')}
          />
          <IconButton
            icon="palette-outline"
            size={22}
            onPress={() => setShowColor(true)}
          />
          <IconButton
            icon="label-outline"
            size={22}
            onPress={handleLabelPress}
          />
          {note && (
            <Text variant="labelSmall" style={styles.updatedAt}>
              {formatRelativeTime(note.updatedAt)}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      <ColorPicker
        visible={showColor}
        current={form.color}
        onSelect={setColor}
        onDismiss={() => setShowColor(false)}
      />

      {note && (
        <LabelPickerSheet
          visible={showLabels}
          noteId={note.id}
          currentLabels={note.labels}
          onDismiss={() => setShowLabels(false)}
          onChanged={handleLabelChanged}
        />
      )}

      <Snackbar
        visible={!!snackMsg}
        onDismiss={() => setSnackMsg('')}
        duration={2000}
      >
        {snackMsg}
      </Snackbar>
    </SafeAreaView>
  );
}

// ─── ChecklistRow (メモ化済み) ────────────────────────────────────────────────

interface RowProps {
  itemKey:      string;
  text:         string;
  isChecked:    boolean;
  onChangeText: (key: string, text: string) => void;
  onToggle:     (key: string) => void;
  onRemove:     (key: string) => void;
  done?:        boolean;
  autoFocus?:   boolean;
}

const ChecklistRow = memo(function ChecklistRow({
  itemKey, text, isChecked, onChangeText, onToggle, onRemove, done, autoFocus,
}: RowProps) {
  return (
    <View style={rowStyles.row}>
      <TouchableOpacity
        onPress={() => onToggle(itemKey)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name={isChecked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
          size={22}
          color={isChecked ? '#999' : '#444'}
        />
      </TouchableOpacity>
      <TextInput
        style={[rowStyles.input, done && rowStyles.done]}
        value={text}
        onChangeText={(t) => onChangeText(itemKey, t)}
        placeholder="アイテム"
        placeholderTextColor="#bbb"
        multiline={false}
        autoFocus={autoFocus}
      />
      <TouchableOpacity
        onPress={() => onRemove(itemKey)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons name="close" size={18} color="#bbb" />
      </TouchableOpacity>
    </View>
  );
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    paddingVertical: 6,
    minHeight:       44,
  },
  input: { flex: 1, fontSize: 15, color: '#333' },
  done:  { textDecorationLine: 'line-through', color: '#999' },
});

const styles = StyleSheet.create({
  container:     { flex: 1 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:        { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 80 },
  titleInput: {
    fontSize:        20,
    fontWeight:      '600',
    color:           '#1a1a1a',
    paddingVertical: 4,
    marginBottom:    spacing.sm,
    minHeight:       44,
  },
  divider:      { marginVertical: spacing.sm },
  contentInput: {
    fontSize:   15,
    color:      '#333',
    minHeight:  200,
    lineHeight: 22,
  },
  checklist: { gap: 2 },
  addItem: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.xs,
    paddingVertical: spacing.sm,
    minHeight:       44,
  },
  doneLabel: { color: '#888', marginBottom: spacing.xs },
  bottomBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.sm,
    borderTopWidth:    1,
    borderTopColor:    '#eee',
    height:            52,
  },
  updatedAt: {
    color:       '#aaa',
    marginLeft:  'auto',
    marginRight: spacing.sm,
  },
});
