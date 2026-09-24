import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useThemeStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/colors';
interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  variant?: 'primary' | 'secondary';
}
export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  accessibilityLabel,
  variant = 'primary',
}: Props) {
  const styles = useThemeStyles(themedStyles);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      activeOpacity={0.75}
      style={[
        styles.button,
        variant === 'secondary' && styles.secondary,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
    >
      <Text
        style={[styles.text, variant === 'secondary' && styles.secondaryText]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}
const themedStyles = (Colors: Palette) =>
  StyleSheet.create({
    button: {
      backgroundColor: Colors.primary,
      padding: 14,
      minWidth: 48,
      minHeight: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 4,
    },
    secondary: { backgroundColor: Colors.accent },
    secondaryText: { color: Colors.onAccent },
    disabled: { opacity: 0.5 },
    text: { color: Colors.onPrimary, fontWeight: '700', fontSize: 15 },
  });
