import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeStyles } from '../../theme/useTheme';
import { Palette } from '../../theme/colors';
export default function ProductSkeleton() {
  const s = useThemeStyles(styles);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading products"
      style={s.list}
    >
      {[0, 1, 2].map(i => (
        <View key={i} style={s.card}>
          <View style={s.title} />
          <View style={s.image} />
          <View style={s.line} />
        </View>
      ))}
    </View>
  );
}
const styles = (c: Palette) =>
  StyleSheet.create({
    list: { gap: 16, padding: 16 },
    card: { backgroundColor: c.card, borderRadius: 18, padding: 20, gap: 14 },
    title: {
      height: 22,
      width: '70%',
      borderRadius: 8,
      backgroundColor: c.border,
    },
    image: { height: 60, borderRadius: 8, backgroundColor: c.border },
    line: {
      height: 18,
      width: '45%',
      borderRadius: 8,
      backgroundColor: c.border,
    },
  });
