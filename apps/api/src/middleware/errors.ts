import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
export interface ErrorDetails {
  status: number;
  code: string;
  message: string;
  retryAfter?: string;
}
export function classifyError(error: unknown): ErrorDetails {
  if (error instanceof ApiError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  if (error instanceof ZodError) {
    return {
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Request parameters are invalid',
    };
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return {
      status: 400,
      code: 'INVALID_JSON',
      message: 'Request body must be valid JSON',
    };
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    return {
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large',
    };
  }
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2024')
  ) {
    return {
      status: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'The service is temporarily unavailable',
      retryAfter: '5',
    };
  }
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };
}
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  const { status, code, message, retryAfter } = classifyError(error);
  if (retryAfter) res.setHeader('Retry-After', retryAfter);
  if (status >= 500) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'request_failed',
        requestId: res.locals.requestId,
        errorType: error instanceof Error ? error.name : 'Unknown',
      }),
    );
  }
  res.status(status).json({
    success: false,
    error: { code, message },
    requestId: res.locals.requestId,
  });
};
