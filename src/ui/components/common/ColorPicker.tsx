import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Portal, Modal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NoteColor } from '@/domain/entities/Note';
import { NOTE_COLOR_LIGHT, NOTE_COLOR_ORDER, NOTE_COLOR_LABEL } from '@/ui/theme/colors';
import { spacing } from '@/ui/theme/spacing';

interface Props {
  visible:  boolean;
  current:  NoteColor;
  onSelect: (color: NoteColor) => void;
  onDismiss: () => void;
}

export function ColorPicker({ visible, current, onSelect, onDismiss }: Props) {
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <Text variant="titleSmall" style={styles.title}>色を選択</Text>
        <View style={styles.palette}>
          {NOTE_COLOR_ORDER.map((color) => (
            <TouchableOpacity
              key={color}
              style={[styles.swatch, { backgroundColor: NOTE_COLOR_LIGHT[color] }]}
              onPress={() => { onSelect(color); onDismiss(); }}
              accessibilityLabel={NOTE_COLOR_LABEL[color]}
            >
              {current === color && (
                <MaterialCommunityIcons name="check" size={18} color="#333" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: '#fff',
    margin:          spacing.xl,
    borderRadius:    16,
    padding:         spacing.md,
  },
  title: {
    marginBottom: spacing.md,
  },
  palette: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  swatch: {
    width:          40,
    height:         40,
    borderRadius:   20,
    borderWidth:    1,
    borderColor:    '#ddd',
    alignItems:     'center',
    justifyContent: 'center',
  },
});
