import React from 'react';
import { Alert, Linking } from 'react-native';
import { Platform } from '../../models/Product';
import PrimaryButton from '../common/PrimaryButton';
const urls: Record<Platform, string> = {
  BLINKIT: 'https://blinkit.com',
  ZEPTO: 'https://www.zepto.com',
  SWIGGY: 'https://www.swiggy.com/instamart',
};
export default function OrderCTA({ winner }: { winner: Platform | null }) {
  if (!winner) return null;
  return (
    <PrimaryButton
      title={`Visit ${winner}`}
      onPress={() => {
        void Linking.openURL(urls[winner]).catch(() =>
          Alert.alert(
            'Unable to open retailer',
            'Please open the retailer app or website manually.',
          ),
        );
      }}
    />
  );
}
