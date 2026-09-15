import { ComparisonRequest } from '../../../../packages/contracts';
import { getProductsByIds } from '../repositories/product.repository';
import { calculateComparison } from '../domain/comparison';
import { env } from '../config/env';
export async function compareCart(request: ComparisonRequest) {
  const products = await getProductsByIds(
    request.items.map(item => item.productId),
    request.location,
  );
  return calculateComparison(
    request,
    products,
    new Date(),
    env.OFFER_MAX_AGE_SECONDS * 1000,
  );
}
