import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Platform } from '../../models/Product';
import { Colors } from '../../theme/colors';
export default function WinnerCard({ winner }: { winner: Platform | null }) {
  return (
    <Text style={styles.title}>
      {winner
        ? `Lowest item total: ${winner}`
        : 'No platform can fulfill this entire basket'}
    </Text>
  );
}
const styles = StyleSheet.create({
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginVertical: 16,
  },
});
