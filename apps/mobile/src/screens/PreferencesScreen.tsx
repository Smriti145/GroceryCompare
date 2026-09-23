import { useThemeStore, ThemeMode } from '../theme/useTheme';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, Switch, View } from 'react-native';
import { usePreferenceStore } from '../store/preferenceStore';
import { RETAILERS } from '../../../../packages/contracts/checkout';
import { Preferences } from '../../../../packages/contracts/preferences';
import PrimaryButton from '../components/common/PrimaryButton';
import api, { errorMessage } from '../api/axios';
import { useSessionStore } from '../store/sessionStore';
import { useFeatureStyles } from '../theme/features';
export default function PreferencesScreen() {
  const s = useFeatureStyles();
  const themeMode = useThemeStore(v => v.mode), setMode = useThemeStore(v => v.setMode);
  const saved = usePreferenceStore(v => v.preferences);
  const setPreferences = usePreferenceStore(v => v.setPreferences);
  const session = useSessionStore(v => v.tokens);
  const [draft, setDraft] = useState(saved);
  const [brands, setBrands] = useState(saved.preferredBrands.join(', '));
  const [eta, setEta] = useState(saved.maxEtaMinutes?.toString() || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    const maxEta = eta.trim() ? Number(eta) : null;
    if (
      maxEta !== null &&
      (!Number.isInteger(maxEta) || maxEta < 1 || maxEta > 10080)
    ) {
      setMessage('Enter an ETA between 1 and 10080 minutes, or leave blank.');
      return;
    }
    const preferences = {
      ...draft,
      maxEtaMinutes: maxEta,
      preferredBrands: brands
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
        .slice(0, 20),
    };
    setBusy(true);
    try {
      if (session) await api.put('/account/preferences', preferences);
      setPreferences(preferences);
      setMessage(
        session
          ? 'Saved to your account and this device.'
          : 'Saved on this device. Sign in to sync with your account.',
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Text style={s.title}>Shop your way</Text>
      <Text style={s.heading}>Appearance</Text>
      {(['system','light','dark'] as ThemeMode[]).map(value => <PrimaryButton key={value} title={`${value === themeMode ? '✓ ' : ''}${value}`} variant="secondary" onPress={() => setMode(value)} />)}
      <Text style={s.text}>Choose what matters for your next comparison.</Text>
      {(['CHEAPEST', 'FASTEST', 'BALANCED'] as const).map(mode => (
        <PrimaryButton
          key={mode}
          title={`${draft.mode === mode ? '✓ ' : ''}${mode.toLowerCase()}`}
          variant="secondary"
          onPress={() => setDraft({ ...draft, mode })}
        />
      ))}
      <Text style={s.text}>
        Balanced ranks price plus ₹1 per minute of waiting. This affects
        ranking, not the amount you pay.
      </Text>
      <View style={s.row}>
        <Text style={s.text}>One platform only</Text>
        <Switch
          accessibilityLabel="Single platform only"
          value={draft.singlePlatformOnly}
          onValueChange={singlePlatformOnly =>
            setDraft({ ...draft, singlePlatformOnly })
          }
        />
      </View>
      <Text style={s.heading}>Avoid platforms</Text>
      {RETAILERS.map(retailer => (
        <View style={s.row} key={retailer}>
          <Text style={s.text}>{retailer}</Text>
          <Switch
            accessibilityLabel={`Avoid ${retailer}`}
            value={draft.avoidedRetailers.includes(retailer)}
            onValueChange={on =>
              setDraft({
                ...draft,
                avoidedRetailers: on
                  ? [...draft.avoidedRetailers, retailer]
                  : draft.avoidedRetailers.filter(v => v !== retailer),
              })
            }
          />
        </View>
      ))}
      <TextInput
        style={s.input}
        accessibilityLabel="Maximum ETA in minutes"
        placeholder="Maximum ETA in minutes (optional)"
        keyboardType="number-pad"
        value={eta}
        onChangeText={setEta}
        maxLength={5}
      />
      <TextInput
        style={s.input}
        accessibilityLabel="Preferred brands"
        placeholder="Preferred brands, separated by commas"
        value={brands}
        onChangeText={setBrands}
        maxLength={500}
      />
      <View style={s.row}>
        <Text style={s.text}>Suggest substitutions</Text>
        <Switch
          accessibilityLabel="Allow substitution suggestions"
          value={draft.substitutionsAllowed}
          onValueChange={substitutionsAllowed =>
            setDraft({ ...draft, substitutionsAllowed })
          }
        />
      </View>
      <Text style={s.text}>
        Preferred brands rank substitution suggestions first. You confirm each
        replacement in product insights.
      </Text>
      <Text style={s.heading}>Required product tags</Text>
      {(
        [
          'VEGETARIAN',
          'VEGAN',
          'ORGANIC',
          'GLUTEN_FREE',
        ] as Preferences['dietaryTags']
      ).map(tag => (
        <View key={tag} style={s.row}>
          <Text style={s.text}>{tag.replace('_', ' ')}</Text>
          <Switch
            accessibilityLabel={tag}
            value={draft.dietaryTags.includes(tag)}
            onValueChange={on =>
              setDraft({
                ...draft,
                dietaryTags: on
                  ? [...draft.dietaryTags, tag]
                  : draft.dietaryTags.filter(v => v !== tag),
              })
            }
          />
        </View>
      ))}
      <Text style={s.text}>
        Products with missing or unverified tags are excluded. This can leave no
        eligible basket.
      </Text>
      <PrimaryButton
        title={busy ? 'Saving…' : 'Save preferences'}
        disabled={busy}
        onPress={() => {
          void save();
        }}
      />
      <Text accessibilityLiveRegion="polite" style={s.text}>
        {message}
      </Text>
    </ScrollView>
  );
}
