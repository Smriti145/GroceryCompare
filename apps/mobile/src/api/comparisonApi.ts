import api from './axios';
import type {
  ApiSuccess,
  Comparison,
  ComparisonRequest,
} from '../../../../packages/contracts';
export async function compareCart(
  request: ComparisonRequest,
  signal?: AbortSignal,
): Promise<Comparison> {
  const response = await api.post<ApiSuccess<Comparison>>('/compare', request, {
    signal,
  });
  return response.data.data;
}
