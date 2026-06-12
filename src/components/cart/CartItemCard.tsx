import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CartItem } from '../../models/Cart';
import { Colors } from '../../theme/colors';
import PrimaryButton from '../common/PrimaryButton';
interface Props {
  item: CartItem;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}
export default function CartItemCard({ item, onQuantity, onRemove }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.product.name}</Text>
      <Text style={styles.detail}>
        {item.product.brand} · {item.product.quantity}
      </Text>
      <View style={styles.row}>
        <View style={styles.stepper}>
          <PrimaryButton
            variant="secondary"
            title="−"
            accessibilityLabel={`Decrease ${item.product.name} quantity`}
            disabled={item.quantity <= 1}
            onPress={() => onQuantity(item.quantity - 1)}
          />
          <Text
            accessibilityLabel={`${item.quantity} units`}
            style={styles.quantity}
          >
            {item.quantity}
          </Text>
          <PrimaryButton
            variant="secondary"
            title="+"
            accessibilityLabel={`Increase ${item.product.name} quantity`}
            disabled={item.quantity >= 99}
            onPress={() => onQuantity(item.quantity + 1)}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.product.name}`}
          onPress={onRemove}
          style={styles.remove}
        >
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    borderRadius: 20,
    marginBottom: 12,
  },
  name: { color: Colors.textPrimary, fontWeight: '700', fontSize: 18 },
  detail: { color: Colors.textSecondary, marginTop: 6 },
  quantity: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  remove: { minHeight: 48, justifyContent: 'center', padding: 8 },
  removeText: { color: Colors.danger, fontWeight: '600' },
});
