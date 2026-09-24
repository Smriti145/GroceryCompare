import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PrimaryButton from '../common/PrimaryButton';
import { useThemeStyles } from '../../theme/useTheme';
import type { Palette } from '../../theme/colors';
export default function FloatingCart({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  const styles = useThemeStyles(themedStyles);

  if (!count) return null;
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>
          {count} {count === 1 ? 'item' : 'items'} in your basket
        </Text>
        <Text style={styles.subtitle}>Find your best complete basket</Text>
      </View>
      <PrimaryButton title="View cart →" onPress={onPress} />
    </View>
  );
}
const themedStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: {
      paddingTop: 10,
      paddingBottom: 4,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderColor: Colors.border,
    },
    title: { color: Colors.textPrimary, fontWeight: '700', fontSize: 14 },
    subtitle: { color: Colors.textSecondary, fontSize: 11, marginTop: 4 },
  });
