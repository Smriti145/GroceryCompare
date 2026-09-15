import { config } from 'dotenv';
// Explicit environment variables always win; local settings are development only.
if (process.env.NODE_ENV !== 'production')
  config({ path: '.env.local', quiet: true });
config({ quiet: true });
import { z } from 'zod';
const boolean = z.enum(['true', 'false']).transform(value => value === 'true');
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'A PostgreSQL DATABASE_URL is required'),
  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(10000).default(120),
  OFFER_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(604800)
    .default(86400),
  ALLOW_DEMO_DATA: boolean.optional(),
});
export function parseEnv(input: NodeJS.ProcessEnv) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Invalid configuration: ${parsed.error.issues
        .map(i => i.path.join('.'))
        .join(', ')}`,
    );
  }
  const data = parsed.data;
  return {
    ...data,
    ALLOW_DEMO_DATA: data.ALLOW_DEMO_DATA ?? data.NODE_ENV !== 'production',
  };
}
export const env = parseEnv(process.env);
