import type { Retailer } from './checkout';
export interface Preferences {
  mode: 'CHEAPEST' | 'FASTEST' | 'BALANCED';
  singlePlatformOnly: boolean;
  avoidedRetailers: Retailer[];
  maxEtaMinutes: number | null;
  preferredBrands: string[];
  substitutionsAllowed: boolean;
  dietaryTags: ('VEGETARIAN' | 'VEGAN' | 'ORGANIC' | 'GLUTEN_FREE')[];
}
export const defaultPreferences: Preferences = {
  mode: 'CHEAPEST',
  singlePlatformOnly: false,
  avoidedRetailers: [],
  maxEtaMinutes: null,
  preferredBrands: [],
  substitutionsAllowed: false,
  dietaryTags: [],
};
