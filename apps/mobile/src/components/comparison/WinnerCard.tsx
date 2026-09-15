import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Platform } from '../../models/Product';
import { Colors } from '../../theme/colors';
export default function WinnerCard({ winner }: { winner: Platform | null }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>RECOMMENDED</Text>
      <Text style={styles.title}>
        {winner
          ? `Lowest item total: ${winner}`
          : 'No platform can fulfill this entire basket'}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 20,
    padding: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  label: {
    color: Colors.secondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
});
