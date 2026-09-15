import { Request, Response } from 'express';
import * as repository from '../repositories/product.repository';
import {
  productQuerySchema,
  productIdSchema,
  locationSchema,
} from '../domain/validation';
import { ApiError } from '../middleware/errors';
export async function getProducts(req: Request, res: Response) {
  const query = productQuerySchema.parse(req.query);
  res.json({
    success: true,
    data: await repository.getAllProducts(query),
    requestId: res.locals.requestId,
  });
}
export async function getProduct(req: Request, res: Response) {
  const id = productIdSchema.parse(req.params.id);
  const location = locationSchema.parse(req.query.location);
  const product = await repository.getProductById(id, location);
  if (!product)
    throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  res.json({ success: true, data: product, requestId: res.locals.requestId });
}
