import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View, Share, Alert } from 'react-native';
import { defaultPreferences } from '../../../../packages/contracts/preferences';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import api, { errorMessage } from '../api/axios';
import { useSessionStore, SessionTokens } from '../store/sessionStore';
import { usePreferenceStore } from '../store/preferenceStore';
import { useCartStore } from '../store/cartStore';
import { useAppStore } from '../store/appStore';
import PrimaryButton from '../components/common/PrimaryButton';
import { useFeatureStyles } from '../theme/features';
interface Device {
  id: string;
  deviceName: string;
  revokedAt: string | null;
  expiresAt: string;
}
interface InboxAlert {
  id: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}
interface Watch {
  id: string;
  kind: string;
}
export default function AccountScreen() {
  const s = useFeatureStyles();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tokens = useSessionStore(v => v.tokens),
    setTokens = useSessionStore(v => v.setTokens);
  const preferences = usePreferenceStore(v => v.preferences),
    setPreferences = usePreferenceStore(v => v.setPreferences);
  const cart = useCartStore(v => v.cart),
    pincode = useAppStore(v => v.location);
  const client = useQueryClient();
  const [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [challenge, setChallenge] = useState('');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['account', tokens?.sessionId],
    enabled: Boolean(tokens),
    queryFn: async ({ signal }) => {
      const [me, sessions, watches] = await Promise.all([
        api.get('/account/me', { signal }),
        api.get<Device[]>('/account/sessions', { signal }),
        api.get<Watch[]>('/alerts/watches', { signal }),
      ]);
      return {
        me: me.data as { email: string },
        sessions: sessions.data,
        watches: watches.data,
      };
    },
  });
  const inbox = useInfiniteQuery({
    queryKey: ['account', tokens?.sessionId, 'inbox'],
    enabled: Boolean(tokens),
    initialPageParam: null as string | null,
    queryFn: async ({ signal, pageParam }) =>
      (
        await api.get<{ alerts: InboxAlert[]; nextCursor: string | null }>(
          '/alerts',
          { signal, params: pageParam ? { cursor: pageParam } : {} },
        )
      ).data,
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
  const alerts = inbox.data?.pages.flatMap(p => p.alerts) || [];
  async function action(run: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await run();
      await client.invalidateQueries({ queryKey: ['account'] });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function clearSession() {
    setTokens(null);
    setPreferences(defaultPreferences);
    await client.cancelQueries({ queryKey: ['account'] });
    client.removeQueries({ queryKey: ['account'] });
  }
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      {tokens ? (
        <PrimaryButton
          title="Saved baskets"
          variant="secondary"
          onPress={() => navigation.navigate('SavedBaskets')}
        />
      ) : null}
      <Text style={s.title}>Your account</Text>
      {!tokens ? (
        <>
          <Text style={s.text}>
            Sign in with an email code. Login needs a configured email service.
            This build keeps tokens in memory; sign in again after restarting
            the app.
          </Text>
          <TextInput
            style={s.input}
            accessibilityLabel="Email address"
            placeholder="Email address"
            value={email}
            onChangeText={v => {
              setEmail(v);
              setChallenge('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={254}
          />
          <PrimaryButton
            title="Send sign-in code"
            disabled={busy || !email.includes('@')}
            onPress={() => {
              void action(async () => {
                const r = await api.post('/account/otp', {
                  email: email.trim(),
                });
                setChallenge(r.data.challengeId);
                setMessage('Check your email for a six-digit code.');
              });
            }}
          />
          {challenge ? (
            <>
              <TextInput
                style={s.input}
                accessibilityLabel="Sign-in code"
                placeholder="Six-digit code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
              />
              <PrimaryButton
                title="Sign in"
                disabled={busy || code.length !== 6}
                onPress={() => {
                  void action(async () => {
                    const r = await api.post<SessionTokens>('/account/verify', {
                      challengeId: challenge,
                      code,
                      deviceName: 'GroceryCompare mobile',
                    });
                    setTokens(r.data);
                    setCode('');
                    setChallenge('');
                    const me = await api.get('/account/me');
                    setPreferences(me.data.preferences);
                  });
                }}
              />
            </>
          ) : null}
        </>
      ) : (
        <>
          <Text style={s.text}>
            {query.data?.me.email || 'Loading account…'}
          </Text>
          <PrimaryButton
            title="Refresh account and alerts"
            disabled={busy || query.isFetching}
            variant="secondary"
            onPress={() => {
              void query.refetch();
              void inbox.refetch();
            }}
          />
          <Text style={s.heading}>Watch your current cart</Text>
          <Text style={s.text}>
            Watches save this basket, pincode and preferences. Alerts appear
            here after the alert worker checks fresh retailer data.
          </Text>
          {(['CART_CHEAPER', 'ETA_IMPROVEMENT', 'DEAL'] as const).map(kind => (
            <PrimaryButton
              key={kind}
              title={`Watch ${kind.toLowerCase().replaceAll('_', ' ')}`}
              disabled={
                busy || !cart.length || !/^[1-9][0-9]{5}$/.test(pincode)
              }
              variant="secondary"
              onPress={() => {
                void action(async () => {
                  await api.post('/alerts/watches', {
                    kind,
                    pincode,
                    preferences,
                    items: cart.map(i => ({
                      productId: i.product.id,
                      quantity: i.quantity,
                    })),
                  });
                  setMessage('Cart watch saved.');
                });
              }}
            />
          ))}
          <Text style={s.heading}>Alert inbox</Text>
          {!alerts.length ? (
            <Text style={s.text}>
              No alerts yet. The first observation sets a baseline.
            </Text>
          ) : null}
          {alerts.map(item => (
            <View key={item.id} style={s.card}>
              <Text style={s.text}>{item.message}</Text>
              <Text style={s.text}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
              {!item.readAt ? (
                <PrimaryButton
                  title="Mark read"
                  disabled={busy}
                  variant="secondary"
                  onPress={() => {
                    void action(async () => {
                      await api.patch(`/alerts/${item.id}/read`);
                    });
                  }}
                />
              ) : null}
            </View>
          ))}
          {inbox.hasNextPage ? (
            <PrimaryButton
              title="Load older alerts"
              disabled={inbox.isFetchingNextPage}
              onPress={() => {
                void inbox.fetchNextPage();
              }}
            />
          ) : null}
          {inbox.isError ? (
            <Text style={s.text}>{errorMessage(inbox.error)}</Text>
          ) : null}
          <Text style={s.heading}>Saved watches</Text>
          {query.data?.watches.map(w => (
            <View key={w.id} style={s.card}>
              <Text style={s.text}>{w.kind}</Text>
              <PrimaryButton
                title="Remove watch"
                disabled={busy}
                variant="secondary"
                onPress={() => {
                  void action(async () => {
                    await api.delete(`/alerts/watches/${w.id}`);
                  });
                }}
              />
            </View>
          ))}
          <Text style={s.heading}>Device sessions</Text>
          {query.data?.sessions.map(device => (
            <View key={device.id} style={s.card}>
              <Text style={s.text}>
                {device.deviceName}
                {device.id === tokens.sessionId ? ' · this device' : ''} ·{' '}
                {device.revokedAt
                  ? 'revoked'
                  : 'expires ' +
                    new Date(device.expiresAt).toLocaleDateString()}
              </Text>
              {!device.revokedAt ? (
                <PrimaryButton
                  title="Revoke session"
                  disabled={busy}
                  variant="secondary"
                  onPress={() => {
                    void action(async () => {
                      await api.delete(`/account/sessions/${device.id}`);
                      if (device.id === tokens.sessionId) await clearSession();
                    });
                  }}
                />
              ) : null}
            </View>
          ))}
          <PrimaryButton
            title="Export account data"
            disabled={busy}
            variant="secondary"
            onPress={() => {
              void action(async () => {
                const r = await api.get('/account/export');
                await Share.share({
                  title: 'GroceryCompare account export',
                  message: JSON.stringify(r.data, null, 2),
                });
              });
            }}
          />
          <PrimaryButton
            title="Sign out all devices"
            disabled={busy}
            variant="secondary"
            onPress={() => {
              void action(async () => {
                await api.delete('/account/sessions');
                await clearSession();
              });
            }}
          />
          <PrimaryButton
            title="Delete account"
            disabled={busy}
            variant="secondary"
            onPress={() =>
              Alert.alert(
                'Delete your account?',
                'This permanently removes your preferences, sessions, watches and alerts.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void action(async () => {
                        await api.delete('/account/me', {
                          data: { confirmation: 'DELETE' },
                        });
                        await clearSession();
                      });
                    },
                  },
                ],
              )
            }
          />
        </>
      )}
      {query.isError && tokens ? (
        <Text style={s.text}>{errorMessage(query.error)}</Text>
      ) : null}
      <Text style={s.text} accessibilityLiveRegion="polite">
        {busy ? 'Working…' : message}
      </Text>
    </ScrollView>
  );
}
