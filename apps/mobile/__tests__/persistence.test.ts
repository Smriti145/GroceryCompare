import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCartStore } from '../src/store/cartStore';
import { useAppStore } from '../src/store/appStore';
const product = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Milk',
  brand: 'Test',
  category: 'Dairy',
  quantity: '1l',
  variants: [],
};
beforeEach(async () => {
  await AsyncStorage.clear();
  useCartStore.setState({ cart: [], hydrated: false, storageError: false });
});
test('restores valid quantities and preserves store actions', async () => {
  await AsyncStorage.setItem(
    'grocery-cart',
    JSON.stringify({
      version: 1,
      state: { cart: [{ product, quantity: 2 }], clearCart: null },
    }),
  );
  await useCartStore.persist.rehydrate();
  expect(useCartStore.getState().cart[0].quantity).toBe(2);
  expect(useCartStore.getState().hydrated).toBe(true);
  useCartStore.getState().clearCart();
  expect(useCartStore.getState().cart).toEqual([]);
});
test.each([
  null,
  'invalid',
  [{ product: null, quantity: 1 }],
  [{ product, quantity: -1 }],
  [
    { product, quantity: 1 },
    { product, quantity: 1 },
  ],
])('recovers from invalid cart data: %j', async cart => {
  await AsyncStorage.setItem(
    'grocery-cart',
    JSON.stringify({ version: 1, state: { cart } }),
  );
  await useCartStore.persist.rehydrate();
  expect(useCartStore.getState().cart).toEqual([]);
  expect(useCartStore.getState().hydrated).toBe(true);
  expect(useCartStore.getState().storageError).toBe(true);
});
test('invalid saved preferences cannot break location or actions', async () => {
  useAppStore.setState({ location: 'DEMO' });
  await AsyncStorage.setItem(
    'grocery-preferences',
    JSON.stringify({
      version: 1,
      state: { location: null, setLocation: null },
    }),
  );
  await useAppStore.persist.rehydrate();
  expect(useAppStore.getState().location).toBe('DEMO');
  useAppStore.getState().setLocation('560001');
  expect(useAppStore.getState().location).toBe('560001');
});
