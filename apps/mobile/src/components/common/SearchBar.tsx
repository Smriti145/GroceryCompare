import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { useThemeStyles, useColors } from '../../theme/useTheme';
import type { Palette } from '../../theme/colors';
interface Props {
  onSubmit?: () => void;
  value: string;
  onChange: (value: string) => void;
}
export default function SearchBar({ value, onChange, onSubmit }: Props) {
  const styles = useThemeStyles(themedStyles);
  const Colors = useColors();

  return (
    <TextInput
      accessibilityLabel="Search groceries"
      returnKeyType="search"
      onSubmitEditing={onSubmit}
      placeholder="Search groceries..."
      maxLength={100}
      placeholderTextColor={Colors.textSecondary}
      value={value}
      onChangeText={onChange}
      style={styles.input}
    />
  );
}
const themedStyles = (Colors: Palette) =>
  StyleSheet.create({
    input: {
      color: Colors.textPrimary,
      backgroundColor: Colors.card,
      minHeight: 52,
      fontSize: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: 16,
      marginVertical: 12,
    },
  });
