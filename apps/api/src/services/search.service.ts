import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { cached } from '../infrastructure/redis';
import { servingStores } from './location.service';
import { env } from '../config/env';
import { ApiError } from '../middleware/errors';
export const normalizeQuery = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
export async function searchCatalog(q: { location: string; search: string; category?: string; limit: number; cursor?: string }) {
  const search = normalizeQuery(q.search);
  const fingerprint = createHash('sha256').update(JSON.stringify([q.location, search, q.category || '', q.limit])).digest('hex').slice(0, 16);
  let offset = 0;
  if (q.cursor) {
    try { const decoded = JSON.parse(Buffer.from(q.cursor, 'base64url').toString()); if (decoded.f !== fingerprint || !Number.isInteger(decoded.o) || decoded.o < 0 || decoded.o > 10000) throw new Error(); offset = decoded.o; }
    catch { throw new ApiError(400, 'INVALID_CURSOR', 'Search cursor is invalid for this query'); }
  }
  const stores = await servingStores({ pincode: q.location });
  if (!stores.length) return { products: [], nextCursor: null };
  return cached('search', q.location, { search, category: q.category, limit: q.limit, offset, stores: stores.map(s => s.id) }, 10, async () => {
    const aliases = await prisma.searchAlias.findMany({ where: { term: { in: [search, ...search.split(' ')] } }, take: 30 });
    const expansions = new Map(aliases.map(a => [a.term, a.replacement]));
    const query = expansions.get(search) || search.split(' ').map(t => expansions.get(t) || t).join(' ');
    const doc = Prisma.sql`(p.name || ' ' || p.brand || ' ' || p.category)`;
    const serving = Prisma.join(stores.map(s => Prisma.sql`(o.retailer=${s.retailer} AND o."storeId"=${s.storeId} AND o."sellerId"=${s.sellerId})`), ' OR ');
    const rows = await prisma.$queryRaw<{ id: string; name: string; brand: string; category: string; quantity: string; imageUrl: string | null }[]>(Prisma.sql`
      SELECT p.id,p.name,p.brand,p.category,p.quantity,p."imageUrl" FROM "Product" p
      WHERE p."deletedAt" IS NULL ${q.category ? Prisma.sql`AND p.category=${q.category}` : Prisma.empty}
      AND (${query}='' OR to_tsvector('simple',${doc}) @@ websearch_to_tsquery('simple',${query}) OR ${query} <% lower(${doc}))
      AND EXISTS (SELECT 1 FROM "RetailerOffer" o JOIN "RetailerProduct" rp ON rp.retailer=o.retailer AND rp.sku=o.sku
        WHERE o."productId"=p.id AND o.location=${q.location} AND o."inStock" AND o."stockQuantity">0
        AND rp."deletedAt" IS NULL AND rp.status='MATCHED' AND o."observedAt">${new Date(Date.now()-env.OFFER_MAX_AGE_SECONDS*1000)} AND o."observedAt"<=${new Date()} AND (${serving}))
      ORDER BY (ts_rank(to_tsvector('simple',${doc}),websearch_to_tsquery('simple',${query})) + word_similarity(${query},lower(${doc}))) DESC,p.id
      LIMIT ${q.limit + 1} OFFSET ${offset}`);
    return { products: rows.slice(0, q.limit).map(p => ({ ...p, variants: [] })), nextCursor: rows.length > q.limit && offset + q.limit <= 10000 ? Buffer.from(JSON.stringify({ f: fingerprint, o: offset + q.limit })).toString('base64url') : null };
  });
}
