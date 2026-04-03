import { ErrorCode } from '../config/errors.js';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY = 1000; // 1s

/**
 * Returns true if the given HTTP status code should trigger a retry.
 * Only 429 and 5xx errors are retried.
 */
export function shouldRetry(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Calculate retry delay in milliseconds.
 * Uses Retry-After header if present, otherwise exponential backoff.
 */
export function getRetryDelay(response: Response, attempt: number, baseDelay = DEFAULT_BASE_DELAY): number {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  // Exponential backoff: baseDelay * 2^(attempt - 1)
  return baseDelay * Math.pow(2, attempt - 1);
}

/**
 * Wraps an async function with retry logic using exponential backoff.
 * Only retries on 429 and 5xx responses.
 * Throws an Error with RETRY_EXHAUSTED code when all attempts fail.
 */
export async function withRetry<T extends Response>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelay = options?.baseDelay ?? DEFAULT_BASE_DELAY;

  let lastResponse: T | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fn();

    if (!shouldRetry(response.status)) {
      return response;
    }

    lastResponse = response;

    if (attempt < maxAttempts) {
      const delay = getRetryDelay(response, attempt, baseDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const error = new Error(`All ${maxAttempts} retry attempts exhausted`) as Error & { code: ErrorCode };
  error.code = ErrorCode.RETRY_EXHAUSTED;
  throw error;
}
