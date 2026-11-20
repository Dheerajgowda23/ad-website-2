import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
export const unauthorized = (code = 'AUTH_REQUIRED', message = 'Sign in to continue') =>
  new ApiError(401, code, message);
export const forbidden = (code = 'FORBIDDEN', message = 'You do not have access to this action') =>
  new ApiError(403, code, message);
export const notFound = (message = 'Not found') => new ApiError(404, 'NOT_FOUND', message);

export const parseBody = <T>(schema: { parse: (input: unknown) => T }, input: unknown): T => schema.parse(input);

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details ?? undefined },
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Check the submitted values',
        details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    });
    return;
  }
  logger.error({ err: error }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  // Deliberately identical for "no such route" and "route exists in the other
  // zone": an internal-only path must be indistinguishable from a typo here.
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' }, path: req.path });
};
