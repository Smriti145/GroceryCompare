import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
export default function Loader() {
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
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
