import React, { useState } from 'react';
import { ScrollView, Text, View, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import api, { errorMessage } from '../api/axios';
import { useSessionStore } from '../store/sessionStore';
import { useFeatureStyles } from '../theme/features';
import PrimaryButton from '../components/common/PrimaryButton';
export default function SavedBasketsScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'SavedBaskets'>) {
  const s = useFeatureStyles(),
    tokens = useSessionStore(v => v.tokens);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['account', tokens?.sessionId, 'carts'],
    enabled: Boolean(tokens),
    queryFn: async ({ signal }) =>
      (
        await api.get<
          {
            id: string;
            name: string;
            pincode: string;
            items: { productId: string; quantity: number }[];
          }[]
        >('/carts', { signal })
      ).data,
  });
  async function open(id: string) {
    setBusy(true);
    try {
      const result = await api.post<{ shareId: string }>(`/carts/${id}/open`);
      navigation.navigate('SharedBasket', { id: result.data.shareId });
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    try {
      await api.delete(`/carts/${id}`);
      await query.refetch();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Text style={s.title}>Saved baskets</Text>
      {!tokens ? (
        <PrimaryButton
          title="Sign in"
          onPress={() => navigation.navigate('Account')}
        />
      ) : null}
      {query.isPending && tokens ? (
        <Text style={s.text}>Loading baskets…</Text>
      ) : null}
      {query.isError ? (
        <PrimaryButton
          title="Retry saved baskets"
          onPress={() => {
            void query.refetch();
          }}
        />
      ) : null}
      {query.data?.length === 0 ? (
        <Text style={s.text}>
          Save a basket from your cart to reuse it here.
        </Text>
      ) : null}
      {query.data?.map(c => (
        <View key={c.id} style={s.card}>
          <Text style={s.heading}>{c.name}</Text>
          <Text style={s.text}>
            {c.items.length} products · {c.pincode}
          </Text>
          <PrimaryButton
            title="Review basket"
            disabled={busy}
            onPress={() => {
              void open(c.id);
            }}
          />
          <PrimaryButton
            title="Delete saved basket"
            disabled={busy}
            variant="secondary"
            onPress={() =>
              Alert.alert('Delete saved basket?', c.name, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    void remove(c.id);
                  },
                },
              ])
            }
          />
        </View>
      ))}
      <Text style={s.text} accessibilityLiveRegion="polite">
        {message}
      </Text>
    </ScrollView>
  );
}
