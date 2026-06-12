import { Request, Response } from 'express';
import { compareCart } from '../services/comparison.service';
import { comparisonSchema } from '../domain/validation';
export async function compareProducts(req: Request, res: Response) {
  const request = comparisonSchema.parse(req.body);
  res.json({ success: true, data: await compareCart(request), requestId: res.locals.requestId });
}
