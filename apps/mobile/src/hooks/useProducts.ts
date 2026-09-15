import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchProducts } from '../api/productApi';
export function useProducts(
  location: string,
  search: string,
  category?: string,
) {
  return useInfiniteQuery({
    queryKey: ['products', location, search, category],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      fetchProducts(location, search, pageParam, signal, category),
    getNextPageParam: page => page.nextCursor,
    staleTime: 30_000,
  });
}
