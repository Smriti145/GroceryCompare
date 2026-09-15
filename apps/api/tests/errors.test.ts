import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { classifyError } from '../src/middleware/errors';

test('classifies database startup failures as retryable outages', () => {
  const error = new Prisma.PrismaClientInitializationError(
    'Database offline',
    '6.16.2',
  );
  assert.deepEqual(classifyError(error), {
    status: 503,
    code: 'DATABASE_UNAVAILABLE',
    message: 'The service is temporarily unavailable',
    retryAfter: '5',
  });
});

test('does not expose unexpected error messages', () => {
  assert.deepEqual(classifyError(new Error('secret database detail')), {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
});
