import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Product } from '../models/Product';
import { CartItem } from '../models/Cart';
import { restoreCart } from './persistence';
interface CartState {
  cart: CartItem[];
  hydrated: boolean;
  storageError: boolean;
  addToCart: (product: Product) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  replaceEquivalent: (originalId: string, product: Product, quantity: number) => boolean;
  loadCart: (items: CartItem[]) => void;
  replaceProduct: (originalId: string, product: Product) => boolean;
  finishHydration: (error?: unknown) => void;
}
export const useCartStore = create<CartState>()(
  persist(
    set => ({
      cart: [],
      hydrated: false,
      storageError: false,
      finishHydration: error =>
        set({ hydrated: true, storageError: Boolean(error) }),
      addToCart: product =>
        set(state => {
          const existing = state.cart.find(
            line => line.product.id === product.id,
          );
          if (existing)
            return {
              cart: state.cart.map(line =>
                line.product.id === product.id
                  ? { product, quantity: Math.min(99, line.quantity + 1) }
                  : line,
              ),
            };
          if (state.cart.length >= 100) return state;
          return { cart: [...state.cart, { product, quantity: 1 }] };
        }),
      setQuantity: (id, quantity) =>
        set(state => ({
          cart:
            Number.isInteger(quantity) && quantity >= 1 && quantity <= 99
              ? state.cart.map(line =>
                  line.product.id === id ? { ...line, quantity } : line,
                )
              : state.cart,
        })),
      removeFromCart: id =>
        set(state => ({
          cart: state.cart.filter(line => line.product.id !== id),
        })),
      replaceProduct: (originalId, product) => {
        let changed = false;
        set(state => {
          const original = state.cart.find(i => i.product.id === originalId);
          const target = state.cart.find(i => i.product.id === product.id);
          if (originalId === product.id) return state;
          const quantity = (original?.quantity ?? 1) + (target?.quantity ?? 0);
          if (
            quantity > 99 ||
            (!original && !target && state.cart.length >= 100)
          )
            return state;
          changed = true;
          return {
            cart: [
              ...state.cart.filter(
                i => i.product.id !== originalId && i.product.id !== product.id,
              ),
              { product, quantity },
            ],
          };
        });
        return changed;
      },
      loadCart: items => set({cart: restoreCart({cart:items})}),
      replaceEquivalent: (originalId, product, quantity) => {
        let changed = false;
        set(state => {
          const target = state.cart.find(i => i.product.id === product.id && i.product.id !== originalId);
          const total = quantity + (target?.quantity ?? 0);
          const others = state.cart.filter(i => i.product.id !== originalId && i.product.id !== product.id);
          if (!Number.isInteger(total) || total < 1 || total > 99 || others.length >= 100) return state;
          changed = true;
          return {cart:[...others, {product, quantity:total}]};
        });
        return changed;
      },
      clearCart: () => set({ cart: [] }),
    }),
    {
      name: 'grocery-cart',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ cart: state.cart }),
      merge: (saved, current) =>
        saved === undefined
          ? current
          : { ...current, cart: restoreCart(saved) },
      onRehydrateStorage: state => (_restored, error) =>
        state.finishHydration(error),
    },
  ),
);
