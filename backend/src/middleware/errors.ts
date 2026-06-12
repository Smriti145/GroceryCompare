import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  let status = 500, code = 'INTERNAL_ERROR', message = 'An unexpected error occurred';
  if (error instanceof ApiError) {
    ({ status, code, message } = error);
  } else if (error instanceof ZodError) {
    status = 400; code = 'INVALID_INPUT'; message = 'Request parameters are invalid';
  } else if (error instanceof SyntaxError && 'body' in error) {
    status = 400; code = 'INVALID_JSON'; message = 'Request body must be valid JSON';
  } else if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request body is too large';
  }
  if (status >= 500) {
    console.error(JSON.stringify({ level: 'error', event: 'request_failed', requestId: res.locals.requestId,
      errorType: error instanceof Error ? error.name : 'Unknown' }));
  }
  res.status(status).json({ success: false, error: { code, message }, requestId: res.locals.requestId });
};
