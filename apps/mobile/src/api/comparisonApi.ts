import api from './axios';
import type {
  ApiSuccess,
  ComparisonRequest,
} from '../../../../packages/contracts';
import type { CheckoutComparison } from '../../../../packages/contracts/checkout';
export async function compareCart(
  request: ComparisonRequest & { maxDeliveries?: number; couponCode?: string },
  signal?: AbortSignal,
): Promise<CheckoutComparison> {
  const response = await api.post<ApiSuccess<CheckoutComparison>>(
    '/checkout/compare',
    {
      items: request.items,
      location: { pincode: request.location },
      maxDeliveries: request.maxDeliveries ?? 2,
      ...(request.couponCode ? { couponCode: request.couponCode } : {}),
    },
    {
      signal,
    },
  );
  return response.data.data;
}
