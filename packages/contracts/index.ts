export const PLATFORMS = ['BLINKIT', 'ZEPTO', 'SWIGGY'] as const;
export type Platform = (typeof PLATFORMS)[number];
export interface Offer {
  id: string;
  platform: Platform;
  platformName: string;
  quantity: string;
  pricePaise: number;
  deliveryTime: number;
  available: boolean;
  location: string;
  updatedAt: string;
  isDemo: boolean;
}
export interface Product {
  imageUrl?: string | null;
  id: string;
  name: string;
  brand: string;
  category: string;
  quantity: string;
  variants: Offer[];
}
export interface CartLine {
  productId: string;
  quantity: number;
}
export interface ComparisonRequest {
  items: CartLine[];
  location: string;
}
export interface MissingItem {
  productId: string;
  reason: 'PRODUCT_NOT_FOUND' | 'NO_VALID_OFFER';
}
export interface PlatformComparison {
  platform: Platform;
  eligible: boolean;
  subtotalPaise: number | null;
  deliveryTime: number | null;
  missingItems: MissingItem[];
  oldestPriceAt: string | null;
  isDemo: boolean;
}
export interface Comparison {
  platforms: PlatformComparison[];
  recommendedPlatform: Platform | null;
  savingsPaise: number;
  location: string;
  currency: 'INR';
  excludesFees: true;
  comparedAt: string;
}
export interface ProductPage {
  products: Product[];
  nextCursor: string | null;
}
export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}
export interface ApiFailure {
  success: false;
  error: { code: string; message: string };
  requestId: string;
}
