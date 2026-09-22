import { useCartStore } from '../src/store/cartStore';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Switch, TextInput } from 'react-native';
import PreferencesScreen from '../src/screens/PreferencesScreen';
import AccountScreen from '../src/screens/AccountScreen';
import PrimaryButton from '../src/components/common/PrimaryButton';
import {
  usePreferenceStore,
  restorePreferences,
} from '../src/store/preferenceStore';
import { defaultPreferences } from '../../../packages/contracts/preferences';
import { useSessionStore } from '../src/store/sessionStore';
import api from '../src/api/axios';
jest.mock('../src/api/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  errorMessage: () => 'Request failed',
}));
afterEach(() => {
  useSessionStore.getState().setTokens(null);
  usePreferenceStore.getState().setPreferences(defaultPreferences);
  jest.clearAllMocks();
});
test('preferences persist user choices and reject invalid restored settings', async () => {
  let view!: Renderer.ReactTestRenderer;
  await act(async () => {
    view = Renderer.create(<PreferencesScreen />);
  });
  try {
    await act(async () => {
      view.root
        .findAllByType(PrimaryButton)
        .find(b => b.props.title === 'fastest')!
        .props.onPress();
    });
    await act(async () => {
      view.root
        .findAllByType(Switch)
        .find(b => b.props.accessibilityLabel === 'Avoid ZEPTO')!
        .props.onValueChange(true);
    });
    await act(async () => {
      view.root
        .findAllByType(TextInput)
        .find(b => b.props.accessibilityLabel === 'Maximum ETA in minutes')!
        .props.onChangeText('25');
    });
    await act(async () => {
      view.root
        .findAllByType(PrimaryButton)
        .find(b => b.props.title === 'Save preferences')!
        .props.onPress();
    });
    expect(usePreferenceStore.getState().preferences).toMatchObject({
      mode: 'FASTEST',
      maxEtaMinutes: 25,
      avoidedRetailers: ['ZEPTO'],
    });
    expect(
      restorePreferences({
        mode: 'BAD',
        maxEtaMinutes: -1,
        preferredBrands: [42],
      }),
    ).toMatchObject({
      mode: 'CHEAPEST',
      maxEtaMinutes: null,
      preferredBrands: [],
    });
  } finally {
    await act(async () => view.unmount());
  }
});
test('email login waits for a code and loads preferences only after successful verification', async () => {
  jest
    .mocked(api.post)
    .mockResolvedValueOnce({ data: { challengeId: 'challenge' } })
    .mockResolvedValueOnce({
      data: {
        accessToken: 'access',
        refreshToken: 'refresh',
        sessionId: 'session',
      },
    });
  jest.mocked(api.get).mockImplementation(async path => ({
    data:
      path === '/account/me'
        ? {
            email: 'test@example.test',
            preferences: { ...defaultPreferences, mode: 'BALANCED' },
          }
        : path === '/alerts'
        ? { alerts: [] }
        : [],
  }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let view!: Renderer.ReactTestRenderer;
  await act(async () => {
    view = Renderer.create(
      <QueryClientProvider client={client}>
        <AccountScreen />
      </QueryClientProvider>,
    );
  });
  try {
    await act(async () => {
      view.root
        .findAllByType(TextInput)
        .find(b => b.props.accessibilityLabel === 'Email address')!
        .props.onChangeText('test@example.test');
    });
    await act(async () => {
      view.root
        .findAllByType(PrimaryButton)
        .find(b => b.props.title === 'Send sign-in code')!
        .props.onPress();
    });
    expect(useSessionStore.getState().tokens).toBeNull();
    await act(async () => {
      view.root
        .findAllByType(TextInput)
        .find(b => b.props.accessibilityLabel === 'Sign-in code')!
        .props.onChangeText('123456');
    });
    await act(async () => {
      view.root
        .findAllByType(PrimaryButton)
        .find(b => b.props.title === 'Sign in')!
        .props.onPress();
    });
    expect(useSessionStore.getState().tokens?.sessionId).toBe('session');
    expect(usePreferenceStore.getState().preferences.mode).toBe('BALANCED');
  } finally {
    await act(async () => view.unmount());
    client.clear();
  }
});

test('confirmed substitution preserves existing target quantities and refuses overflow', async () => {
  const product = {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Milk',
    brand: 'A',
    category: 'Dairy',
    quantity: '1l',
    variants: [],
  };
  const alternative = {
    ...product,
    id: '10000000-0000-4000-8000-000000000002',
    brand: 'B',
  };
  useCartStore.setState({
    cart: [
      { product, quantity: 2 },
      { product: alternative, quantity: 3 },
    ],
  });
  expect(useCartStore.getState().replaceProduct(product.id, alternative)).toBe(
    true,
  );
  expect(useCartStore.getState().cart).toHaveLength(1);
  expect(useCartStore.getState().cart[0].quantity).toBe(5);
  useCartStore.setState({
    cart: [
      { product, quantity: 98 },
      { product: alternative, quantity: 3 },
    ],
  });
  expect(useCartStore.getState().replaceProduct(product.id, alternative)).toBe(
    false,
  );
  expect(useCartStore.getState().cart).toHaveLength(2);
  useCartStore.getState().clearCart();
});
