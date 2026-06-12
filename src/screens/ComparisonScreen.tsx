import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { useCartStore } from '../store/cartStore';
import { useAppStore } from '../store/appStore';
import { useComparison } from '../hooks/useComparison';
import SavingsCard from '../components/comparison/SavingsCard';
import WinnerCard from '../components/comparison/WinnerCard';
import PlatformPriceCard from '../components/comparison/PlatformPriceCard';
import OrderCTA from '../components/comparison/OrderCTA';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import PrimaryButton from '../components/common/PrimaryButton';
import { errorMessage } from '../api/axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
export default function ComparisonScreen() {
  const insets = useSafeAreaInsets();
  const cart = useCartStore(s => s.cart);
  const location = useAppStore(s => s.location);
  const query = useComparison({
    items: cart.map(line => ({
      productId: line.product.id,
      quantity: line.quantity,
    })),
    location,
  });
  if (!cart.length)
    return <EmptyState message="Add products to your cart before comparing." />;
  if (query.isPending) return <Loader />;
  if (query.isError)
    return (
      <EmptyState
        message={errorMessage(query.error)}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  const result = query.data;
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, 24) },
      ]}
    >
      <Text style={styles.text}>Delivery area: {result.location}</Text>
      <WinnerCard winner={result.recommendedPlatform} />
      {result.platforms.filter(p => p.eligible).length > 1 ? (
        <SavingsCard savingsPaise={result.savingsPaise} />
      ) : null}
      <Text style={styles.text}>
        Item totals exclude delivery fees, handling fees, taxes added at
        checkout, and discounts. Estimates are not guaranteed.
      </Text>
      {[...result.platforms]
        .sort(
          (a, b) =>
            Number(b.platform === result.recommendedPlatform) -
            Number(a.platform === result.recommendedPlatform),
        )
        .map(platform => (
          <PlatformPriceCard
            key={platform.platform}
            result={platform}
            recommended={platform.platform === result.recommendedPlatform}
          />
        ))}
      <PrimaryButton
        title={query.isFetching ? 'Refreshing...' : 'Refresh prices'}
        disabled={query.isFetching}
        onPress={() => {
          void query.refetch();
        }}
      />
      <OrderCTA winner={result.recommendedPlatform} />
      <Text style={styles.text}>
        Your basket is not transferred. Confirm products and the final total
        with the retailer.
      </Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  text: { color: Colors.textSecondary, marginBottom: 16, lineHeight: 21 },
});
