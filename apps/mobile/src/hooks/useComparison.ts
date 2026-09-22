import type { Preferences } from '../../../../packages/contracts/preferences';
import { useQuery } from '@tanstack/react-query';
import { compareCart } from '../api/comparisonApi';
import type { ComparisonRequest } from '../../../../packages/contracts';
export function useComparison(
  request: ComparisonRequest & {
    maxDeliveries?: number;
    couponCode?: string;
    preferences?: Preferences;
  },
) {
  return useQuery({
    queryKey: ['comparison', request],
    queryFn: ({ signal }) => compareCart(request, signal),
    enabled:
      request.items.length > 0 && /^[1-9][0-9]{5}$/.test(request.location),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 60_000,
  });
}
