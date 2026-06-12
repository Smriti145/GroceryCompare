import { useQuery } from '@tanstack/react-query';
import { compareCart } from '../api/comparisonApi';
import type { ComparisonRequest } from '../../shared/contracts';
export function useComparison(request: ComparisonRequest) {
  return useQuery({ queryKey: ['comparison', request],
    queryFn: ({ signal }) => compareCart(request, signal), enabled: request.items.length > 0,
    staleTime: 0, refetchOnMount: 'always', refetchInterval: 60_000,
  });
}
