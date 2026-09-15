import React from 'react';
import { View, FlatList, StyleSheet, Text, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useCartStore } from '../store/cartStore';
import PrimaryButton from '../components/common/PrimaryButton';
import EmptyState from '../components/common/EmptyState';
import Loader from '../components/common/Loader';
import CartItemCard from '../components/cart/CartItemCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
export default function CartScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Cart'>) {
  const insets = useSafeAreaInsets();
  const { cart, setQuantity, removeFromCart, clearCart, hydrated } =
    useCartStore();
  if (!hydrated) return <Loader />;
  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}
    >
      <Text style={styles.heading}>Your basket</Text>
      <Text style={styles.subtitle}>
        {cart.reduce((sum, line) => sum + line.quantity, 0)} items · Compare all
        three stores together
      </Text>
      <FlatList
        data={cart}
        keyExtractor={item => item.product.id}
        ListEmptyComponent={
          <EmptyState
            message="Your cart is empty."
            actionLabel="Browse products"
            onRetry={() => navigation.navigate('Home')}
          />
        }
        renderItem={({ item }) => (
          <CartItemCard
            item={item}
            onQuantity={quantity => setQuantity(item.product.id, quantity)}
            onRemove={() => removeFromCart(item.product.id)}
          />
        )}
      />
      {cart.length > 0 ? (
        <>
          <PrimaryButton
            variant="secondary"
            title="Clear cart"
            onPress={() =>
              Alert.alert('Clear your basket?', 'All items will be removed.', [
                { text: 'Keep items', style: 'cancel' },
                {
                  text: 'Clear cart',
                  style: 'destructive',
                  onPress: clearCart,
                },
              ])
            }
          />
          <PrimaryButton
            title="Compare prices"
            onPress={() => navigation.navigate('Comparison')}
          />
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  heading: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: { color: Colors.textSecondary, marginBottom: 24 },
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
});
