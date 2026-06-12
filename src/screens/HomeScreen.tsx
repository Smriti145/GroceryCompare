import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useProducts } from '../hooks/useProducts';
import { useCartStore } from '../store/cartStore';
import { useAppStore } from '../store/appStore';
import SearchBar from '../components/common/SearchBar';
import ProductCard from '../components/product/ProductCard';
import FloatingCart from '../components/cart/FloatingCart';
import EmptyState from '../components/common/EmptyState';
import PrimaryButton from '../components/common/PrimaryButton';
import Loader from '../components/common/Loader';
import { errorMessage } from '../api/axios';
import { Colors } from '../theme/colors';
const categories = ['All', 'Dairy', 'Staples', 'Snacks'];
export default function HomeScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const insets = useSafeAreaInsets();
  const location = useAppStore(s => s.location);
  const setLocation = useAppStore(s => s.setLocation);
  const [area, setArea] = useState(location);
  useEffect(() => setArea(location), [location]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const products = useProducts(
    location,
    query,
    category === 'All' ? undefined : category,
  );
  const cart = useCartStore(s => s.cart);
  const hydrated = useCartStore(s => s.hydrated);
  const addToCart = useCartStore(s => s.addToCart);
  const storageError = useCartStore(s => s.storageError);
  const header = (
    <View>
      <Text style={styles.eyebrow}>A LITTLE COMPARISON. MORE SAVINGS.</Text>
      <Text style={styles.heading}>Your groceries.{'\n'}A better price.</Text>
      <Text style={styles.description}>
        One basket. Three stores. Find the best value for your everyday
        essentials.
      </Text>
      <View style={styles.location}>
        <Text style={styles.locationLabel}>
          DELIVERY AREA {location === 'DEMO' ? '· SAMPLE CATALOG' : ''}
        </Text>
        <View style={styles.area}>
          <TextInput
            style={styles.input}
            accessibilityLabel="Delivery area code"
            placeholder="Area code"
            placeholderTextColor={Colors.textSecondary}
            value={area}
            onChangeText={setArea}
            maxLength={64}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <PrimaryButton
            title="Apply"
            variant="secondary"
            disabled={!/^[A-Za-z0-9_-]{1,64}$/.test(area.trim())}
            onPress={() => setLocation(area.trim())}
          />
        </View>
        <Text style={styles.hint}>
          {location === 'DEMO'
            ? 'Explore with sample prices. Live retailer feeds are not connected.'
            : `Showing offers for ${location}`}
        </Text>
      </View>
      <SearchBar value={search} onChange={setSearch} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {categories.map(label => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`${label} category`}
            accessibilityState={{ selected: category === label }}
            onPress={() => setCategory(label)}
            style={[styles.chip, category === label && styles.activeChip]}
          >
            <Text
              style={[styles.chipText, category === label && styles.activeText]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.section}>
        {query
          ? `Results for “${query}”`
          : category === 'All'
          ? 'Everyday essentials'
          : `${category} essentials`}
      </Text>
      <Text style={styles.hint}>
        Prices and availability are verified when you compare.
      </Text>
      {storageError ? (
        <Text accessibilityRole="alert" style={styles.hint}>
          Your saved cart could not be restored. Start a new basket below.
        </Text>
      ) : null}
    </View>
  );
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        <FlatList
          data={products.data?.pages.flatMap(page => page.products) || []}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <ProductCard
              item={item}
              count={
                cart.find(line => line.product.id === item.id)?.quantity || 0
              }
              onAdd={() => addToCart(item)}
              disabled={
                !hydrated ||
                (cart.length >= 100 &&
                  !cart.some(line => line.product.id === item.id)) ||
                cart.some(
                  line => line.product.id === item.id && line.quantity >= 99,
                )
              }
            />
          )}
          ListEmptyComponent={
            products.isPending ? (
              <Loader />
            ) : products.isError ? (
              <EmptyState
                message={errorMessage(products.error)}
                onRetry={() => {
                  void products.refetch();
                }}
              />
            ) : (
              <EmptyState
                message="No groceries found. Try a different search or delivery area."
                actionLabel="Reset filters"
                onRetry={() => {
                  setSearch('');
                  setCategory('All');
                }}
              />
            )
          }
          refreshing={products.isRefetching && !products.isFetchingNextPage}
          onRefresh={() => {
            void products.refetch();
          }}
          ListFooterComponent={
            products.isError && products.data ? (
              <EmptyState
                message={errorMessage(products.error)}
                onRetry={() => {
                  if (products.isFetchNextPageError) {
                    void products.fetchNextPage();
                  } else {
                    void products.refetch();
                  }
                }}
              />
            ) : products.hasNextPage ? (
              <PrimaryButton
                title={products.isFetchingNextPage ? 'Loading...' : 'Load more'}
                variant="secondary"
                disabled={products.isFetchingNextPage}
                onPress={() => {
                  void products.fetchNextPage();
                }}
              />
            ) : null
          }
        />
        <FloatingCart
          count={cart.reduce((sum, item) => sum + item.quantity, 0)}
          onPress={() => navigation.navigate('Cart')}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: Colors.background,
  },
  eyebrow: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 18,
  },
  heading: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1.3,
    color: Colors.textPrimary,
    marginTop: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 20,
  },
  location: { backgroundColor: Colors.tint, borderRadius: 18, padding: 14 },
  locationLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.primary,
    fontWeight: '800',
  },
  hint: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  area: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginVertical: 4,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  categories: { gap: 8, paddingVertical: 6 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  activeChip: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontWeight: '600' },
  activeText: { color: Colors.onPrimary },
  section: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
});
