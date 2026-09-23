import prisma from '../config/prisma';
import { invalidateLocations } from '../infrastructure/redis';
export async function cleanup() {
  const now = new Date(), days = (n: number) => new Date(Date.now()-n*86400000);
  // Raw market snapshots and audit records are deliberately retained; no invented history deletion policy.
  const results = await prisma.$transaction([
    prisma.loginChallenge.deleteMany({ where: { expiresAt: { lt: days(1) } } }),
    prisma.deviceSession.deleteMany({ where: { expiresAt: { lt: days(1) } } }),
    prisma.comparisonShare.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.alert.deleteMany({ where: { createdAt: { lt: days(90) } } }),
    prisma.savedCart.deleteMany({ where: { deletedAt: { lt: days(30) } } }),
    prisma.searchTrend.deleteMany({ where: { updatedAt: { lt: days(30) } } }),
    prisma.retailerOffer.deleteMany({ where: { observedAt: { lt: days(30) } } }),
  ]);
  return results.map(r => r.count);
}
export async function snapshotPage(cursor?: string) {
  const rows = await prisma.retailerOffer.findMany({ where: cursor ? { id: { gt: cursor } } : {}, orderBy: { id: 'asc' }, take: 200 });
  await prisma.priceSnapshot.createMany({ data: rows.map(o => ({ retailer: o.retailer, sku: o.sku, location: o.location, storeId: o.storeId, sellerId: o.sellerId, productId: o.productId, packSize: o.packSize, pricePaise: o.pricePaise, inStock: o.inStock, observedAt: o.observedAt })), skipDuplicates: true });
  return rows.length === 200 ? rows[rows.length - 1].id : null;
}
export async function reconcilePage(cursor?: string) {
  const rows = await prisma.retailerProduct.findMany({ where: cursor ? { id: { gt: cursor } } : {}, orderBy: { id: 'asc' }, take: 100, select:{id:true} });
  for (const row of rows) {
    const areas = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1847291)`;
      const listing=await tx.retailerProduct.findUnique({where:{id:row.id}});
      if(!listing || listing.status!=='MATCHED') return [];
      const mismatch=!listing.canonicalId || await tx.retailerOffer.findFirst({where:{retailer:listing.retailer,sku:listing.sku,productId:{not:listing.canonicalId}},select:{id:true}});
      if(!mismatch) return [];
      await tx.retailerProduct.update({where:{id:row.id},data:{status:'AMBIGUOUS'}});
      await tx.auditLog.create({data:{action:'MAPPING_QUARANTINED',objectType:'RetailerProduct',objectId:row.id,reason:'Canonical mismatch detected during reconciliation'}});
      return tx.retailerOffer.findMany({where:{retailer:listing.retailer,sku:listing.sku},select:{location:true},distinct:['location']});
    });
    await invalidateLocations(areas.map(o=>o.location));
  }
  return rows.length === 100 ? rows[rows.length - 1].id : null;
}
