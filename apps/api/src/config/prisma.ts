import { env } from './env';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
});
export default prisma;
