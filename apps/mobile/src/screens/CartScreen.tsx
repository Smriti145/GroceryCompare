import React, { useState } from 'react';
import { Share } from 'react-native';
import api, { errorMessage } from '../api/axios';
import { useAppStore } from '../store/appStore';
import { useSessionStore } from '../store/sessionStore';
import { View, FlatList, StyleSheet, Text, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useCartStore } from '../store/cartStore';
import PrimaryButton from '../components/common/PrimaryButton';
import EmptyState from '../components/common/EmptyState';
import Loader from '../components/common/Loader';
import CartItemCard from '../components/cart/CartItemCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStyles } from '../theme/useTheme';
import type { Palette } from '../theme/colors';
export default function CartScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Cart'>) {
  const styles = useThemeStyles(themedStyles);

  const insets = useSafeAreaInsets();
  const pincode = useAppStore(s => s.location);
  const tokens = useSessionStore(s => s.tokens);
  const [busy, setBusy] = useState(false);
  async function persistBasket(share: boolean) {
    setBusy(true);
    try {
      const body = { pincode, items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })) };
      if (share) {
        const { data } = await api.post<{url: string}>('/shares', body);
        await Share.share({ message: `Compare my grocery basket (link expires in 7 days; GroceryCompare app required): ${data.url}` });
      } else {
        await api.post('/carts', { ...body, name: `Basket ${new Date().toLocaleDateString()}` });
        Alert.alert('Basket saved', 'Available from Saved baskets on your account.');
      }
    } catch(error) { Alert.alert('Unable to save basket', errorMessage(error)); }
    finally { setBusy(false); }
  }
  const { cart, setQuantity, removeFromCart, clearCart, hydrated } =
    useCartStore();
  if (!hydrated) return <Loader />;
  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}
    >
      <Text style={styles.heading}>Your basket</Text>
      <Text style={styles.subtitle}>
        {cart.reduce((sum, line) => sum + line.quantity, 0)} items · Compare serving retailers
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
          <PrimaryButton title="Share basket" variant="secondary" disabled={busy || !/^[1-9][0-9]{5}$/.test(pincode)} onPress={() => Alert.alert('Share this basket?', 'Anyone with the link can see the items, quantities and delivery pincode for 7 days. Prices are refreshed when opened.', [{text:'Cancel', style:'cancel'}, {text:'Share', onPress:()=>{void persistBasket(true);}}])} />
          <PrimaryButton title={tokens ? 'Save to account' : 'Sign in to save'} variant="secondary" disabled={busy} onPress={() => { if(tokens) {void persistBasket(false);} else navigation.navigate('Account'); }} />
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
const themedStyles = (Colors: Palette) => StyleSheet.create({
  heading: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: { color: Colors.textSecondary, marginBottom: 24 },
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
});
