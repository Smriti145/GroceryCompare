import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/colors';
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
  const styles = useThemeStyles(themedStyles);

  return (
    <View style={styles.container}>
      <Text accessibilityRole="alert" style={styles.text}>
        {message}
      </Text>
      {onRetry ? <PrimaryButton title={actionLabel} onPress={onRetry} /> : null}
    </View>
  );
}
const themedStyles = (Colors: Palette) => StyleSheet.create({
  container: { padding: 20, gap: 12 },
  text: { color: Colors.textSecondary, fontSize: 16 },
});
