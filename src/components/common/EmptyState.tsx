import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import PrimaryButton from './PrimaryButton';
interface Props {
  message: string;
  onRetry?: () => void;
  actionLabel?: string;
}
export default function EmptyState({
  message,
  onRetry,
  actionLabel = 'Try again',
}: Props) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="alert" style={styles.text}>
        {message}
      </Text>
      {onRetry ? <PrimaryButton title={actionLabel} onPress={onRetry} /> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  text: { color: Colors.textSecondary, fontSize: 16 },
});
