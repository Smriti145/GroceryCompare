import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { formatMoney } from '../../utils/money';
import { Colors } from '../../theme/colors';
export default function SavingsCard({
  savingsPaise,
}: {
  savingsPaise: number;
}) {
  return (
    <Text style={styles.text}>
      Save {formatMoney(savingsPaise)} versus the highest complete basket
    </Text>
  );
}
const styles = StyleSheet.create({
  text: { color: Colors.secondary, fontSize: 18, marginBottom: 16 },
});
