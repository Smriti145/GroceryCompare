import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Product } from '../../models/Product';
import PrimaryButton from '../common/PrimaryButton';
import { Colors } from '../../theme/colors';
import { formatMoney } from '../../utils/money';
const icons: Record<string, string> = {
  Dairy: '🥛',
  Staples: '🌾',
  Snacks: '🍪',
  Produce: '🥬',
  Beverages: '☕',
};
interface Props {
  item: Product;
  onAdd: () => void;
  onInsights?: () => void;
  disabled?: boolean;
  count?: number;
}
export default function ProductCard({
  item,
  onAdd,
  onInsights,
  disabled,
  count = 0,
}: Props) {
  const available = item.variants.filter(offer => offer.available);
  const minimum = available.length
    ? Math.min(...available.map(offer => offer.pricePaise))
    : null;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.art}>
          <Text style={styles.emoji} accessible={false}>
            {icons[item.category] || '🛒'}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.category}>{item.category.toUpperCase()}</Text>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.detail}>
            {item.brand} · {item.quantity}
          </Text>
        </View>
      </View>
      {onInsights ? (
        <PrimaryButton
          title="Price history & alternatives"
          variant="secondary"
          onPress={onInsights}
        />
      ) : null}
      <View style={styles.offers}>
        {item.variants.map(offer => (
          <View key={offer.id} style={styles.offer}>
            <Text style={styles.platform}>{offer.platform}</Text>
            <Text style={styles.offerPrice}>
              {offer.available ? formatMoney(offer.pricePaise) : 'Unavailable'}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.detail}>
            {item.variants.some(o => o.isDemo)
              ? 'Sample prices from'
              : 'Store availability checked at comparison'}
          </Text>
          <Text style={styles.price}>
            {minimum === null ? 'Compare checkout costs' : formatMoney(minimum)}
          </Text>
        </View>
        <PrimaryButton
          title={count ? `Add more · ${count} in cart` : '+ Add to cart'}
          accessibilityLabel={`Add ${item.name} to cart`}
          onPress={onAdd}
          disabled={disabled}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  info: { flex: 1, minWidth: 110 },
  art: {
    width: 64,
    height: 70,
    backgroundColor: Colors.accentSoft,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 34 },
  category: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: Colors.secondary,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: 19,
    fontWeight: '700',
    marginVertical: 4,
  },
  detail: { color: Colors.textSecondary, fontSize: 12 },
  offers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 16,
  },
  offer: {
    flexGrow: 1,
    backgroundColor: Colors.tint,
    borderRadius: 10,
    padding: 10,
  },
  platform: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  offerPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  price: {
    color: Colors.primary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 3,
  },
});
