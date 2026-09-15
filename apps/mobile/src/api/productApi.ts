import api from './axios';
import type { ApiSuccess, ProductPage } from '../../../../packages/contracts';
export async function fetchProducts(
  location: string,
  search: string,
  cursor: string | null,
  signal?: AbortSignal,
  category?: string,
): Promise<ProductPage> {
  const response = await api.get<ApiSuccess<ProductPage>>('/products', {
    params: {
      location,
      search,
      limit: 20,
      ...(category ? { category } : {}),
      ...(cursor ? { cursor } : {}),
    },
    signal,
  });
  return response.data.data;
}
