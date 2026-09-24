import { usePreferenceStore } from '../store/preferenceStore';
import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet } from 'react-native';
import { useCartStore } from '../store/cartStore';
import { useAppStore } from '../store/appStore';
import { useComparison } from '../hooks/useComparison';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import PrimaryButton from '../components/common/PrimaryButton';
import { errorMessage } from '../api/axios';
import { useThemeStyles, useColors } from '../theme/useTheme';
import type { Palette } from '../theme/colors';
import { formatMoney } from '../utils/money';
import { BasketPlan } from '../../../../packages/contracts/checkout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const labels = {
  itemSubtotalPaise: 'Items',
  deliveryFeePaise: 'Delivery',
  handlingFeePaise: 'Handling / platform',
  surgeFeePaise: 'Surge / rain',
  smallCartFeePaise: 'Small cart',
  couponDiscountPaise: 'Coupon discount',
  membershipBenefitPaise: 'Membership benefit',
  finalPayablePaise: 'Payable',
};
function PlanCard({
  title,
  plan,
  names,
}: {
  title: string;
  plan: BasketPlan;
  names: Map<string, string>;
}) {
  const styles = useThemeStyles(themedStyles);

  const expired = plan.deliveries.some(
    d => Date.parse(d.validUntil) <= Date.now(),
  );
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        {title}: {formatMoney(plan.finalPayablePaise)}
      </Text>
      <Text style={styles.text}>
        {plan.deliveryCount}{' '}
        {plan.deliveryCount === 1 ? 'delivery' : 'deliveries'}
        {expired ? ' · Quote expired — refresh before ordering' : ''}
      </Text>
      {plan.deliveries.map(delivery => (
        <View key={delivery.store.id} style={styles.delivery}>
          <Text style={styles.heading}>
            {delivery.store.retailer} · {delivery.store.etaMinutes} min
          </Text>
          {delivery.items.map(i => (
            <Text key={i.productId} style={styles.text}>
              {names.get(i.productId) || i.productId} × {i.quantity}
            </Text>
          ))}
          {Object.entries(delivery.costs).map(([key, value]) => (
            <Text key={key} style={styles.text}>
              {labels[key as keyof typeof labels]}:{' '}
              {key === 'couponDiscountPaise' || key === 'membershipBenefitPaise'
                ? '−'
                : ''}
              {formatMoney(value)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
export default function ComparisonScreen() {
  const styles = useThemeStyles(themedStyles);
  const Colors = useColors();

  const insets = useSafeAreaInsets();
  const cart = useCartStore(s => s.cart);
  const location = useAppStore(s => s.location);
  const [maxDeliveries, setMaxDeliveries] = useState(2);
  const [couponDraft, setCouponDraft] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const preferences = usePreferenceStore(s => s.preferences);
  const query = useComparison({
    preferences,
    location,
    maxDeliveries,
    couponCode,
    items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
  });
  if (!/^[1-9][0-9]{5}$/.test(location))
    return (
      <EmptyState message="Choose your delivery pincode on Home before comparing." />
    );
  if (!cart.length)
    return <EmptyState message="Add groceries to compare checkout costs." />;
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
  const names = new Map(cart.map(i => [i.product.id, i.product.name]));
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, 24) },
      ]}
    >
      <Text style={styles.heading}>Checkout comparison · {location}</Text>
      <Text style={styles.text}>
        Ranking: {preferences.mode.toLowerCase()}. ETA is when the last delivery
        arrives.
      </Text>
      {result.explanation ? (
        <Text style={styles.text}>{result.explanation}</Text>
      ) : null}
      {result.recommended ? (
        <PlanCard
          title="Recommended for you"
          plan={result.recommended}
          names={names}
        />
      ) : null}
      <Text style={styles.text}>Maximum deliveries: {maxDeliveries}</Text>
      <View style={styles.options}>
        {[1, 2, 3].map(count => (
          <PrimaryButton
            key={count}
            title={`${count} ${count === 1 ? 'delivery' : 'deliveries'}`}
            variant="secondary"
            disabled={count === maxDeliveries}
            onPress={() => setMaxDeliveries(count)}
          />
        ))}
      </View>
      <TextInput
        accessibilityLabel="Coupon code"
        placeholder="Optional public coupon code"
        placeholderTextColor={Colors.textSecondary}
        value={couponDraft}
        onChangeText={setCouponDraft}
        maxLength={64}
        autoCapitalize="characters"
        style={styles.coupon}
      />
      <PrimaryButton
        title="Apply coupon"
        variant="secondary"
        onPress={() => setCouponCode(couponDraft.trim())}
      />
      {result.providerStatuses
        ?.filter(p => p.status === 'TEMPORARILY_UNAVAILABLE')
        .map(p => (
          <Text key={p.retailer} style={styles.text}>
            {p.retailer} temporarily unavailable. Other verified offers are
            still compared; any retained observations keep their original
            expiry.
          </Text>
        ))}
      {!result.recommended ? (
        <EmptyState message="No verified checkout is available for the entire basket. Coverage, stock quantities, fresh prices and complete fees are all required." />
      ) : null}
      {result.bestSingle ? (
        <PlanCard
          title="Buy all at one store"
          plan={result.bestSingle}
          names={names}
        />
      ) : null}
      {result.bestSplit ? (
        <PlanCard title="Split basket" plan={result.bestSplit} names={names} />
      ) : null}
      {result.itemSavings?.some(i => i.savingsPaise !== 0) ? (
        <Text style={styles.heading}>
          Item savings versus the best single store (before fees)
        </Text>
      ) : null}
      {result.itemSavings
        ?.filter(i => i.savingsPaise !== 0)
        .map(i => (
          <Text key={i.productId} style={styles.text}>
            {names.get(i.productId)}:{' '}
            {i.savingsPaise >= 0 ? 'save' : 'costs extra'}{' '}
            {formatMoney(Math.abs(i.savingsPaise))}
          </Text>
        ))}
      {result.savingsPaise > 0 ? (
        <Text style={styles.heading}>
          Save {formatMoney(result.savingsPaise)} with{' '}
          {result.recommended?.deliveryCount} deliveries
        </Text>
      ) : null}
      {!result.search.complete ? (
        <Text style={styles.text}>
          Search limit reached. These are the best plans found so far, not a
          guaranteed lowest price.
        </Text>
      ) : null}
      <Text style={styles.text}>
        Whole product lines stay together. Fees are included using verified
        store tariffs. Membership savings apply only after entitlement
        verification. Confirm the current quote with each retailer before
        paying.
      </Text>
      <PrimaryButton
        title={query.isFetching ? 'Refreshing...' : 'Refresh checkout costs'}
        disabled={query.isFetching}
        onPress={() => {
          void query.refetch();
        }}
      />
    </ScrollView>
  );
}
const themedStyles = (Colors: Palette) =>
  StyleSheet.create({
    options: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    coupon: {
      minHeight: 48,
      color: Colors.textPrimary,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    content: { padding: 16 },
    container: { flex: 1, backgroundColor: Colors.background },
    card: {
      backgroundColor: Colors.card,
      padding: 16,
      borderRadius: 18,
      marginVertical: 12,
    },
    heading: {
      fontSize: 18,
      fontWeight: '700',
      color: Colors.primary,
      marginBottom: 8,
    },
    text: { color: Colors.textSecondary, marginBottom: 6, lineHeight: 21 },
    delivery: {
      borderTopWidth: 1,
      borderColor: Colors.border,
      paddingTop: 12,
      marginTop: 12,
    },
  });
