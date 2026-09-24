import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useThemeStyles, useColors } from '../../theme/useTheme';
import type { Palette } from '../../theme/colors';
export default function Loader() {
  const styles = useThemeStyles(themedStyles);
  const Colors = useColors();

  return (
    <View style={styles.container}>
      <ActivityIndicator
        accessibilityLabel="Loading"
        size="large"
        color={Colors.primary}
      />
    </View>
  );
}
const themedStyles = (Colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      justifyContent: 'center',
      backgroundColor: Colors.background,
    },
  });
