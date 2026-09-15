import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { useCartStore } from '../src/store/cartStore';
import { fetchProducts } from '../src/api/productApi';
jest.mock('../src/api/productApi', () => ({ fetchProducts: jest.fn() }));
test('browses categories and adds a product to the basket', async () => {
  jest.useFakeTimers();
  jest
    .mocked(fetchProducts)
    .mockResolvedValue({
      products: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Test Milk',
          brand: 'Test',
          category: 'Dairy',
          quantity: '1l',
          variants: [],
        },
      ],
      nextCursor: null,
    });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Delivery area code' }),
    ).toBeTruthy();
    expect(fetchProducts).toHaveBeenCalled();
    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Add Test Milk to cart' })
        .props.onPress();
    });
    expect(useCartStore.getState().cart[0].quantity).toBe(1);
    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Dairy category' })
        .props.onPress();
    });
    expect(fetchProducts).toHaveBeenLastCalledWith(
      'DEMO',
      '',
      null,
      expect.anything(),
      'Dairy',
    );
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    useCartStore.getState().clearCart();
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});
