import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
interface Props {
  value: string;
  onChange: (value: string) => void;
}
export default function SearchBar({ value, onChange }: Props) {
  return (
    <TextInput
      accessibilityLabel="Search groceries"
      placeholder="Search groceries..."
      maxLength={100}
      placeholderTextColor={Colors.textSecondary}
      value={value}
      onChangeText={onChange}
      style={styles.input}
    />
  );
}
const styles = StyleSheet.create({
  input: {
    color: Colors.textPrimary,
    backgroundColor: Colors.card,
    minHeight: 52,
    fontSize: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginVertical: 12,
  },
});
