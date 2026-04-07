import React from 'react';
import { View, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Text, Portal, Modal, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NoteColor } from '@/domain/entities/Note';
import { NOTE_COLOR_LIGHT, NOTE_COLOR_DARK, NOTE_COLOR_ORDER, NOTE_COLOR_LABEL } from '@/ui/theme/colors';
import { spacing } from '@/ui/theme/spacing';

interface Props {
  visible:  boolean;
  current:  NoteColor;
  onSelect: (color: NoteColor) => void;
  onDismiss: () => void;
}

export function ColorPicker({ visible, current, onSelect, onDismiss }: Props) {
  const theme       = useTheme();
  const colorScheme = useColorScheme();
  const palette     = colorScheme === 'dark' ? NOTE_COLOR_DARK : NOTE_COLOR_LIGHT;
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <Text variant="titleSmall" style={styles.title}>色を選択</Text>
        <View style={styles.palette}>
          {NOTE_COLOR_ORDER.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.swatch,
                { backgroundColor: palette[color], borderColor: theme.colors.outline },
              ]}
              onPress={() => { onSelect(color); onDismiss(); }}
              accessibilityLabel={NOTE_COLOR_LABEL[color]}
            >
              {current === color && (
                <MaterialCommunityIcons name="check" size={18} color={theme.colors.onSurface} />
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
    margin:       spacing.xl,
    borderRadius: 16,
    padding:      spacing.md,
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
    borderColor:    'transparent',
    alignItems:     'center',
    justifyContent: 'center',
  },
});
