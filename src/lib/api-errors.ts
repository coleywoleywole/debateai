/**
 * Centralized API error handling utilities.
 * 
 * Provides consistent error responses across all API routes with:
 * - Standardized error format
 * - Proper HTTP status codes
 * - Rate limit headers on all responses
 * - Zod validation helpers
 */

import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { captureError } from '@/lib/sentry';
import { logger } from '@/lib/logger';

/** Standard API error response format */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/** API error codes for programmatic handling */
export const ApiErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  MESSAGE_LIMIT: 'MESSAGE_LIMIT',
  DEBATE_LIMIT: 'DEBATE_LIMIT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  APP_DISABLED: 'APP_DISABLED',
} as const;

export type ApiErrorCode = typeof ApiErrorCodes[keyof typeof ApiErrorCodes];

/** Rate limit info to include in responses */
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Create a standardized error response with optional rate limit headers.
 */
export function apiError(
  status: number,
  message: string,
  options?: {
    code?: ApiErrorCode;
    details?: Record<string, unknown>;
    rateLimit?: RateLimitInfo;
  }
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    error: message,
  };

  if (options?.code) {
    body.code = options.code;
  }

  if (options?.details) {
    body.details = options.details;
  }

  const headers: Record<string, string> = {};

  if (options?.rateLimit) {
    headers['X-RateLimit-Limit'] = String(options.rateLimit.limit);
    headers['X-RateLimit-Remaining'] = String(options.rateLimit.remaining);
    headers['X-RateLimit-Reset'] = String(options.rateLimit.reset);
  }

  return NextResponse.json(body, { status, headers });
}

/**
 * Shorthand error helpers
 */
export const errors = {
  /** 400 Bad Request - validation failed */
  badRequest: (message: string, details?: Record<string, unknown>) =>
    apiError(400, message, { code: ApiErrorCodes.VALIDATION_ERROR, details }),

  /** 401 Unauthorized - not authenticated */
  unauthorized: (message = 'Authentication required') =>
    apiError(401, message, { code: ApiErrorCodes.UNAUTHORIZED }),

  /** 403 Forbidden - authenticated but not authorized */
  forbidden: (message = 'Access denied') =>
    apiError(403, message, { code: ApiErrorCodes.FORBIDDEN }),

  /** 404 Not Found */
  notFound: (message = 'Resource not found') =>
    apiError(404, message, { code: ApiErrorCodes.NOT_FOUND }),

  /** 429 Too Many Requests */
  rateLimited: (rateLimit: RateLimitInfo, message = 'Rate limit exceeded') =>
    apiError(429, message, { code: ApiErrorCodes.RATE_LIMITED, rateLimit }),

  /** 429 Message limit (upgrade prompt) */
  messageLimit: (current: number, limit: number) =>
    apiError(429, `Message limit reached (${current}/${limit}). Upgrade for unlimited.`, {
      code: ApiErrorCodes.MESSAGE_LIMIT,
      details: { current, limit, upgrade_required: true },
    }),

  /** 429 Guest limit (sign up prompt) */
  guestLimit: (current: number, limit: number) =>
    apiError(429, `Guest limit reached (${current}/${limit}). Sign up to continue.`, {
      code: ApiErrorCodes.MESSAGE_LIMIT,
      details: { current, limit, signup_required: true },
    }),

  /** 429 Debate limit (upgrade prompt) */
  debateLimit: (current: number, limit: number) =>
    apiError(429, 'debate_limit_exceeded', {
      code: ApiErrorCodes.DEBATE_LIMIT,
      details: { current, limit, upgrade_required: true },
    }),

  /** 429 Guest debate limit (sign up prompt) */
  guestDebateLimit: (current: number, limit: number) =>
    apiError(429, 'debate_limit_exceeded', {
      code: ApiErrorCodes.DEBATE_LIMIT,
      details: { current, limit, signup_required: true },
    }),

  /** 500 Internal Server Error */
  internal: (message = 'Internal server error') =>
    apiError(500, message, { code: ApiErrorCodes.INTERNAL_ERROR }),

  /** 503 App disabled for maintenance */
  disabled: (message = 'Service temporarily unavailable') =>
    apiError(503, message, { code: ApiErrorCodes.APP_DISABLED }),
};

/**
 * Parse and validate request body with Zod schema.
 * Returns validated data or throws a formatted error response.
 */
export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw errors.badRequest('Invalid JSON body');
  }

  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      const zodError = error as ZodError;
      const fieldErrors = zodError.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw errors.badRequest('Validation failed', { fields: fieldErrors });
    }
    throw errors.badRequest('Invalid request body');
  }
}

/**
 * Wrap an API handler with consistent error handling.
 * Catches thrown NextResponse errors and unknown errors.
 */
export function withErrorHandler<T>(
  handler: (request: Request, context?: T) => Promise<NextResponse>
): (request: Request, context?: T) => Promise<NextResponse> {
  return async (request: Request, context?: T) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // If it's already a NextResponse (from our error helpers), return it
      if (error instanceof NextResponse) {
        return error;
      }

      // Log and report unexpected errors
      const url = request.url;
      const method = request.method;
      logger.error('api.unhandled_error', {
        url,
        method,
        error: error instanceof Error ? error.message : String(error),
      });

      // Report to Sentry with request context
      captureError(error, {
        tags: { api_route: url, method },
        extra: { url, method },
      });

      // Return generic internal error (never leak details)
      return errors.internal();
    }
  };
}

/**
 * Add rate limit headers to a successful response.
 */
export function withRateLimitHeaders<T>(
  response: NextResponse<T>,
  rateLimit: RateLimitInfo
): NextResponse<T> {
  response.headers.set('X-RateLimit-Limit', String(rateLimit.limit));
  response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
  response.headers.set('X-RateLimit-Reset', String(rateLimit.reset));
  return response;
}
