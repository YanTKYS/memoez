import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing } from '@/ui/theme/spacing';

interface Props {
  icon:    string;
  title:   string;
  message: string;
}

export function EmptyState({ icon, title, message }: Props) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon as any} size={64} color="#ccc" />
      <Text variant="titleMedium" style={styles.title}>{title}</Text>
      <Text variant="bodyMedium"  style={styles.message}>{message}</Text>
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
});
