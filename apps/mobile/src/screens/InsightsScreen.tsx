import React, { useState } from 'react';
import { ScrollView, Text, View, Alert, TextInput } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import api, { errorMessage } from '../api/axios';
import { useAppStore } from '../store/appStore';
import { usePreferenceStore } from '../store/preferenceStore';
import { useSessionStore } from '../store/sessionStore';
import { useCartStore } from '../store/cartStore';
import { Product } from '../models/Product';
import PrimaryButton from '../components/common/PrimaryButton';
import { useFeatureStyles } from '../theme/features';
import { formatMoney } from '../utils/money';
interface Series {
  retailer: string;
  sku: string;
  storeId: string;
  sellerId: string;
}
interface History {
  graph: { date: string; pricePaise: number }[];
  lowestEverPaise: number | null;
  lowestRecordedPaise: number | null;
  usualPricePaise: number | null;
  dropTodayPaise: number | null;
  volatilityScore: number | null;
  dealConfidence: string;
  lastObservedAt: string | null;
}
export default function InsightsScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Insights'>) {
  const s = useFeatureStyles();
  const [report, setReport] = useState('');
  const { productId, name } = route.params;
  const pincode = useAppStore(v => v.location),
    preferences = usePreferenceStore(v => v.preferences),
    tokens = useSessionStore(v => v.tokens);
  const [days, setDays] = useState<7 | 30>(7),
    [selected, setSelected] = useState<Series | null>(null);
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const series = useQuery({
    queryKey: ['series', productId, pincode],
    enabled: /^[1-9][0-9]{5}$/.test(pincode),
    queryFn: async ({ signal }) =>
      (
        await api.get<Series[]>(`/history/${productId}/series`, {
          params: { pincode },
          signal,
        })
      ).data,
  });
  const choice = selected || series.data?.[0];
  const history = useQuery({
    queryKey: ['history', productId, pincode, choice, days],
    enabled: Boolean(choice),
    queryFn: async ({ signal }) =>
      (
        await api.get<History>(`/history/${productId}`, {
          params: { pincode, ...choice, days },
          signal,
        })
      ).data,
  });
  const alternatives = useQuery({
    queryKey: ['substitutions', productId, preferences],
    enabled: preferences.substitutionsAllowed,
    queryFn: async ({ signal }) =>
      (
        await api.post<Product[]>(
          '/checkout/substitutions',
          { productId, preferences },
          { signal },
        )
      ).data,
  });
  const quantity = useCartStore(
    v => v.cart.find(i => i.product.id === productId)?.quantity ?? 1,
  );
  const packs = useQuery({
    queryKey: ['packs', productId, quantity, pincode],
    enabled: /^[1-9][0-9]{5}$/.test(pincode),
    queryFn: async ({ signal }) =>
      (
        await api.post<
          {
            product: Product;
            quantity: number;
            retailer: string;
            storeId: string;
            itemTotalPaise: number;
            savingsPaise: number | null;
            explanation: string;
          }[]
        >('/checkout/packs', { productId, quantity, pincode }, { signal })
      ).data,
  });
  const maximum = Math.max(
    1,
    ...(history.data?.graph.map(v => v.pricePaise) || []),
  );
  async function watch(kind: string) {
    setBusy(true);
    try {
      await api.post('/alerts/watches', {
        kind,
        productId,
        pincode,
        ...choice,
        preferences,
      });
      setMessage('Watch saved. Alerts will appear in your account inbox.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Text style={s.title}>{name}</Text>
      <Text style={s.heading}>Equivalent pack sizes</Text>
      <Text style={s.text}>
        Same brand, product and variant; item totals before fees.
      </Text>
      {packs.isError ? (
        <PrimaryButton
          title="Retry pack comparison"
          onPress={() => {
            void packs.refetch();
          }}
        />
      ) : null}
      {!packs.isPending && !packs.data?.length ? (
        <Text style={s.text}>No verified equivalent packs available here.</Text>
      ) : null}
      {packs.data?.map(p => (
        <View key={`${p.product.id}:${p.retailer}:${p.storeId}`} style={s.card}>
          <Text style={s.text}>
            {p.quantity} × {p.product.quantity} · {p.retailer} ·{' '}
            {formatMoney(p.itemTotalPaise)}
          </Text>
          <Text style={s.text}>
            {p.explanation}
            {p.savingsPaise !== null && p.savingsPaise > 0
              ? ` Save ${formatMoney(p.savingsPaise)} on items at this store.`
              : ''}
          </Text>
          <PrimaryButton
            title="Use these packs"
            variant="secondary"
            onPress={() =>
              Alert.alert('Replace pack size?', p.explanation, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Replace',
                  onPress: () =>
                    setMessage(
                      useCartStore
                        .getState()
                        .replaceEquivalent(productId, p.product, p.quantity)
                        ? 'Basket updated. Compare again to apply preferences and checkout fees.'
                        : 'Basket quantity limit reached.',
                    ),
                },
              ])
            }
          />
        </View>
      ))}
      <Text style={s.heading}>Price history</Text>
      <Text style={s.text}>
        Item prices before checkout fees. Each graph is for one retailer, SKU,
        store and seller in {pincode}. Days use UTC.
      </Text>
      <View style={s.row}>
        {([7, 30] as const).map(d => (
          <PrimaryButton
            key={d}
            title={`${d} days`}
            disabled={days === d}
            variant="secondary"
            onPress={() => setDays(d)}
          />
        ))}
      </View>
      {series.data?.map(item => (
        <PrimaryButton
          key={JSON.stringify(item)}
          title={`${item.retailer} · ${item.storeId} · ${item.sku}`}
          variant="secondary"
          onPress={() => setSelected(item)}
        />
      ))}
      {series.isLoading || history.isLoading ? (
        <Text style={s.text}>Loading observations…</Text>
      ) : null}
      {series.isError || history.isError ? (
        <>
          <Text style={s.text}>
            {errorMessage(series.error || history.error)}
          </Text>
          <PrimaryButton
            title="Retry history"
            onPress={() => {
              void series.refetch();
              void history.refetch();
            }}
          />
        </>
      ) : null}
      {!series.isLoading && !history.data?.graph.length ? (
        <Text style={s.text}>
          No price observations in this window. History starts when authorized
          feeds are imported.
        </Text>
      ) : null}
      {history.data?.graph.map(point => (
        <View
          key={point.date}
          style={s.card}
          accessibilityLabel={`${point.date}: ${formatMoney(point.pricePaise)}`}
        >
          <Text style={s.text}>
            {point.date} · {formatMoney(point.pricePaise)}
          </Text>
          <View
            style={[s.bar, { width: `${(point.pricePaise / maximum) * 100}%` }]}
          />
        </View>
      ))}
      {history.data ? (
        <View style={s.card}>
          <Text style={s.text}>
            Lowest in this window:{' '}
            {history.data.lowestRecordedPaise === null
              ? '—'
              : formatMoney(history.data.lowestRecordedPaise)}
          </Text>
          <Text style={s.text}>
            Lowest ever recorded:{' '}
            {history.data.lowestEverPaise === null
              ? '—'
              : formatMoney(history.data.lowestEverPaise)}
          </Text>
          <Text style={s.text}>
            Usually:{' '}
            {history.data.usualPricePaise === null
              ? 'More history needed'
              : formatMoney(history.data.usualPricePaise)}
          </Text>
          <Text style={s.text}>
            Drop today:{' '}
            {history.data.dropTodayPaise === null
              ? 'No consecutive-day data'
              : formatMoney(history.data.dropTodayPaise)}
          </Text>
          <Text style={s.text}>
            Volatility: {history.data.volatilityScore ?? '—'} / 100 · Deal
            evidence:{' '}
            {history.data.dealConfidence.toLowerCase().replaceAll('_', ' ')}
          </Text>
          <Text style={s.text}>
            Last observed:{' '}
            {history.data.lastObservedAt
              ? new Date(history.data.lastObservedAt).toLocaleString()
              : '—'}
          </Text>
        </View>
      ) : null}
      {tokens && choice ? (
        <>
          <PrimaryButton
            title="Alert me on price drops"
            disabled={busy}
            onPress={() => {
              void watch('PRICE_DROP');
            }}
          />
          <PrimaryButton
            title="Alert me when back in stock"
            disabled={busy}
            variant="secondary"
            onPress={() => {
              void watch('BACK_IN_STOCK');
            }}
          />
        </>
      ) : (
        <PrimaryButton
          title="Sign in to create alerts"
          variant="secondary"
          onPress={() => navigation.navigate('Account')}
        />
      )}
      {tokens ? (
        <View style={s.card}>
          <Text style={s.heading}>Report a product issue</Text>
          <TextInput
            style={s.input}
            accessibilityLabel="Product issue"
            value={report}
            onChangeText={setReport}
            placeholder="Describe an incorrect price or product mapping"
            maxLength={1000}
            multiline
          />
          <PrimaryButton
            title="Send report"
            disabled={busy || report.trim().length < 10}
            onPress={() => {
              setBusy(true);
              void api
                .post('/reports', { productId, message: report.trim() })
                .then(() => {
                  setReport('');
                  setMessage('Report sent for review.');
                })
                .catch(e => setMessage(errorMessage(e)))
                .finally(() => setBusy(false));
            }}
          />
        </View>
      ) : null}
      <Text style={s.text} accessibilityLiveRegion="polite">
        {message}
      </Text>
      {preferences.substitutionsAllowed ? (
        <>
          <Text style={s.heading}>Compatible alternatives</Text>
          <Text style={s.text}>
            Preferred brands appear first. Availability and fees are checked
            after you choose.
          </Text>
          {!alternatives.isLoading && !alternatives.data?.length ? (
            <Text style={s.text}>
              No verified compatible alternatives found.
            </Text>
          ) : null}
          {alternatives.isError ? (
            <Text style={s.text}>{errorMessage(alternatives.error)}</Text>
          ) : null}
          {alternatives.data?.map(product => (
            <PrimaryButton
              key={product.id}
              title={`Choose ${product.brand} ${product.name} · ${product.quantity}`}
              variant="secondary"
              onPress={() =>
                Alert.alert(
                  'Use this alternative?',
                  'Replace this item in your basket, or add it if the original is not in your basket.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Use alternative',
                      onPress: () => {
                        const changed = useCartStore
                          .getState()
                          .replaceProduct(productId, product);
                        setMessage(
                          changed
                            ? 'Basket updated. Compare again for availability and checkout costs.'
                            : 'Basket limit reached. Adjust quantities before replacing this item.',
                        );
                      },
                    },
                  ],
                )
              }
            />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
