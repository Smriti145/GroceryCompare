export const RETAILERS = [
  'BLINKIT',
  'ZEPTO',
  'SWIGGY',
  'BIGBASKET',
  'DMART_READY',
] as const;
export type Retailer = (typeof RETAILERS)[number];
export interface BasketLine {
  productId: string;
  quantity: number;
}
export interface DeliveryLocation {
  pincode: string;
  latitude?: number;
  longitude?: number;
}
export interface ServiceStore {
  id: string;
  retailer: Retailer;
  storeId: string;
  sellerId: string;
  pincode: string;
  etaMinutes: number;
  expiresAt: string;
}
export interface CostBreakdown {
  itemSubtotalPaise: number;
  deliveryFeePaise: number;
  handlingFeePaise: number;
  surgeFeePaise: number;
  smallCartFeePaise: number;
  couponDiscountPaise: number;
  membershipBenefitPaise: number;
  finalPayablePaise: number;
}
export interface DeliveryPlan {
  itemCosts?: { productId: string; totalPaise: number }[];
  store: ServiceStore;
  items: BasketLine[];
  costs: CostBreakdown;
  validUntil: string;
}
export interface BasketPlan {
  deliveries: DeliveryPlan[];
  finalPayablePaise: number;
  deliveryCount: number;
}
export interface CheckoutComparison {
  explanation?: string;
  itemSavings?: { productId: string; savingsPaise: number }[];
  providerStatuses?: { retailer: Retailer; status: string }[];
  pincode: string;
  singles: BasketPlan[];
  bestSingle: BasketPlan | null;
  bestSplit: BasketPlan | null;
  savingsPaise: number;
  recommended: BasketPlan | null;
  status: 'QUOTED' | 'NO_VERIFIED_CHECKOUT';
  comparedAt: string;
  search: {
    complete: boolean;
    evaluated: number;
    maxDeliveries: number;
    wholeLinesOnly: true;
  };
  unavailable: { storeId: string; reason: string }[];
}
