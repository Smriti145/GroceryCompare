import type { Preferences } from '../../../../packages/contracts/preferences';
import api from './axios';
import type {
  ApiSuccess,
  ComparisonRequest,
} from '../../../../packages/contracts';
import type { CheckoutComparison } from '../../../../packages/contracts/checkout';
export async function compareCart(
  request: ComparisonRequest & {
    maxDeliveries?: number;
    couponCode?: string;
    preferences?: Preferences;
  },
  signal?: AbortSignal,
): Promise<CheckoutComparison> {
  const response = await api.post<
    ApiSuccess<CheckoutComparison> & {
      providers?: CheckoutComparison['providerStatuses'];
    }
  >(
    '/checkout/compare',
    {
      preferences: request.preferences,
      items: request.items,
      location: { pincode: request.location },
      maxDeliveries: request.maxDeliveries ?? 2,
      ...(request.couponCode ? { couponCode: request.couponCode } : {}),
    },
    {
      signal,
    },
  );
  return { ...response.data.data, providerStatuses: response.data.providers };
}
