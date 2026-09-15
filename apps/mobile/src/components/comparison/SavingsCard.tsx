import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatMoney } from '../../utils/money';
import { Colors } from '../../theme/colors';
export default function SavingsCard({
  savingsPaise,
}: {
  savingsPaise: number;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>YOUR SAVINGS</Text>
      <Text style={styles.amount}>{formatMoney(savingsPaise)}</Text>
      <Text style={styles.text}>versus the highest complete basket</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.secondary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  label: {
    color: Colors.onPrimary,
    opacity: 0.8,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  amount: {
    color: Colors.onPrimary,
    fontSize: 30,
    fontWeight: '800',
    marginVertical: 4,
  },
  text: { color: Colors.onPrimary, fontSize: 13 },
});
