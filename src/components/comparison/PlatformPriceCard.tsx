import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PlatformComparison } from '../../models/Comparison';
import { Colors } from '../../theme/colors';
import { formatMoney } from '../../utils/money';
export default function PlatformPriceCard({
  result,
  recommended = false,
}: {
  result: PlatformComparison;
  recommended?: boolean;
}) {
  return (
    <View style={[styles.card, recommended && styles.recommended]}>
      <View style={styles.row}>
        <Text style={styles.title}>{result.platform}</Text>
        <Text style={[styles.badge, !result.eligible && styles.unavailable]}>
          {recommended
            ? 'BEST VALUE'
            : result.eligible
            ? 'COMPLETE BASKET'
            : 'UNAVAILABLE'}
        </Text>
      </View>
      <Text style={styles.price}>
        {result.eligible && result.subtotalPaise !== null
          ? formatMoney(result.subtotalPaise)
          : 'Incomplete basket'}
      </Text>
      {result.eligible ? (
        <>
          <Text style={styles.text}>
            ◷ Estimated delivery · {result.deliveryTime} min
          </Text>
          <Text style={styles.footnote}>
            Prices updated{' '}
            {result.oldestPriceAt
              ? new Date(result.oldestPriceAt).toLocaleString()
              : 'at an unknown time'}
          </Text>
        </>
      ) : (
        <Text style={styles.text}>
          {result.missingItems.length} item(s) have no current offer for this
          pack size and area.
        </Text>
      )}
      {result.isDemo ? (
        <Text style={styles.footnote}>
          Sample prices · not a live retailer quote
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recommended: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.tint,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  price: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 18,
  },
  badge: {
    color: Colors.primary,
    fontSize: 9,
    letterSpacing: 0.5,
    fontWeight: '800',
  },
  unavailable: { color: Colors.danger },
  text: { color: Colors.textSecondary, marginTop: 10, lineHeight: 20 },
  footnote: { color: Colors.textSecondary, fontSize: 11, marginTop: 8 },
});
