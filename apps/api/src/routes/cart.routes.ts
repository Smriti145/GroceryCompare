import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import prisma from '../config/prisma';
import { requireAccount } from '../auth/service';
import { comparisonSchema } from '../domain/validation';
import { ApiError } from '../middleware/errors';
const basket = z
  .object({
    pincode: z.string().regex(/^[1-9][0-9]{5}$/),
    items: comparisonSchema.shape.items,
  })
  .strict();
async function validateProducts(items: { productId: string }[]) {
  if (
    (await prisma.product.count({
      where: { id: { in: items.map(i => i.productId) }, deletedAt: null },
    })) !== items.length
  )
    throw new ApiError(
      422,
      'UNKNOWN_PRODUCT',
      'One or more products are unavailable',
    );
}
export const shareRoutes = Router();
shareRoutes.post('/', async (req, res) => {
  const b = basket.parse(req.body);
  await validateProducts(b.items);
  const id = randomBytes(24).toString('base64url');
  const row = await prisma.comparisonShare.create({
    data: { id, ...b, expiresAt: new Date(Date.now() + 7 * 86400000) },
  });
  res
    .status(201)
    .json({
      id,
      expiresAt: row.expiresAt,
      url: `grocerycompare://share/${id}`,
    });
});
shareRoutes.get('/:id', async (req, res) => {
  const id = z
    .string()
    .regex(/^[A-Za-z0-9_-]{32}$/)
    .parse(req.params.id);
  const row = await prisma.comparisonShare.findFirst({
    where: { id, expiresAt: { gt: new Date() } },
  });
  if (!row)
    throw new ApiError(
      410,
      'SHARE_EXPIRED',
      'This shared basket is unavailable or expired',
    );
  const b = basket.parse({ pincode: row.pincode, items: row.items });
  const products = await prisma.product.findMany({
    where: { id: { in: b.items.map(i => i.productId) }, deletedAt: null },
    select: {
      id: true,
      name: true,
      brand: true,
      category: true,
      quantity: true,
      imageUrl: true,
    },
  });
  res.json({
    ...b,
    expiresAt: row.expiresAt,
    products: products.map(p => ({ ...p, variants: [] })),
  });
});
export const cartRoutes = Router();
cartRoutes.use(requireAccount);
cartRoutes.get('/', async (_req, res) =>
  res.json(
    await prisma.savedCart.findMany({
      where: { accountId: res.locals.account.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
  ),
);
cartRoutes.post('/:id/open', async (req, res) => {
  const row = await prisma.savedCart.findFirst({
    where: {
      id: z.string().uuid().parse(req.params.id),
      accountId: res.locals.account.id,
      deletedAt: null,
    },
  });
  if (!row) throw new ApiError(404, 'CART_NOT_FOUND', 'Saved basket not found');
  const share = await prisma.comparisonShare.create({
    data: {
      id: randomBytes(24).toString('base64url'),
      pincode: row.pincode,
      items: row.items!,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  res.json({ shareId: share.id });
});
cartRoutes.post('/', async (req, res) => {
  const b = basket
    .extend({ name: z.string().trim().min(1).max(80) })
    .parse(req.body);
  await validateProducts(b.items);
  const accountId = res.locals.account.id;
  const row = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${accountId}))`;
    if (
      (await tx.savedCart.count({ where: { accountId, deletedAt: null } })) >=
      20
    )
      throw new ApiError(422, 'CART_LIMIT', 'Save up to 20 baskets');
    const result = await tx.savedCart.create({ data: { ...b, accountId } });
    await tx.auditLog.create({
      data: {
        actorId: accountId,
        action: 'CART_SAVED',
        objectType: 'SavedCart',
        objectId: result.id,
        reason: 'User saved basket',
      },
    });
    return result;
  });
  res.status(201).json(row);
});
cartRoutes.delete('/:id', async (req, res) => {
  await prisma.savedCart.updateMany({
    where: {
      id: z.string().uuid().parse(req.params.id),
      accountId: res.locals.account.id,
    },
    data: { deletedAt: new Date() },
  });
  res.status(204).end();
});
export const reportRoutes = Router();
reportRoutes.use(requireAccount);
reportRoutes.post('/', async (req, res) => {
  const b = z
    .object({
      productId: z.string().uuid().optional(),
      message: z.string().trim().min(10).max(1000),
    })
    .strict()
    .parse(req.body);
  res
    .status(201)
    .json(
      await prisma.userReport.create({
        data: { ...b, accountId: res.locals.account.id },
      }),
    );
});
