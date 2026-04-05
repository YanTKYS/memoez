import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing } from '@/ui/theme/spacing';

interface Props {
  icon:    string;
  title:   string;
  message: string;
  /** オプションのアクションボタン（エラー時のリトライなど） */
  action?: {
    label:   string;
    onPress: () => void;
  };
}

export function EmptyState({ icon, title, message, action }: Props) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon as any} size={64} color="#ccc" />
      <Text variant="titleMedium" style={styles.title}>{title}</Text>
      <Text variant="bodyMedium"  style={styles.message}>{message}</Text>
      {action && (
        <Button mode="outlined" onPress={action.onPress} style={styles.button}>
          {action.label}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xl,
    gap:            spacing.sm,
  },
  title: {
    color:     '#666',
    textAlign: 'center',
  },
  message: {
    color:     '#999',
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.sm,
  },
});
