import { describe, it, expect, vi } from 'vitest';
import { shouldRetry, getRetryDelay, withRetry } from '../src/proxy/retry.js';
import { ErrorCode } from '../src/config/errors.js';

describe('shouldRetry', () => {
  it('retries on 429', () => {
    expect(shouldRetry(429)).toBe(true);
  });

  it('retries on 5xx', () => {
    expect(shouldRetry(500)).toBe(true);
    expect(shouldRetry(502)).toBe(true);
    expect(shouldRetry(503)).toBe(true);
    expect(shouldRetry(504)).toBe(true);
  });

  it('does not retry on 4xx (except 429)', () => {
    expect(shouldRetry(400)).toBe(false);
    expect(shouldRetry(401)).toBe(false);
    expect(shouldRetry(403)).toBe(false);
    expect(shouldRetry(404)).toBe(false);
  });

  it('does not retry on 2xx/3xx', () => {
    expect(shouldRetry(200)).toBe(false);
    expect(shouldRetry(201)).toBe(false);
    expect(shouldRetry(301)).toBe(false);
    expect(shouldRetry(304)).toBe(false);
  });
});

describe('getRetryDelay', () => {
  it('uses Retry-After header when present', () => {
    const response = new Response(null, { headers: { 'Retry-After': '5' } });
    expect(getRetryDelay(response, 1)).toBe(5000);
  });

  it('uses exponential backoff when no Retry-After', () => {
    const response = new Response(null);
    expect(getRetryDelay(response, 1, 1000)).toBe(1000);
    expect(getRetryDelay(response, 2, 1000)).toBe(2000);
    expect(getRetryDelay(response, 3, 1000)).toBe(4000);
  });

  it('Retry-After takes precedence over exponential backoff', () => {
    const response = new Response(null, { headers: { 'Retry-After': '10' } });
    expect(getRetryDelay(response, 1, 1000)).toBe(10000);
    expect(getRetryDelay(response, 2, 1000)).toBe(10000);
  });
});

describe('withRetry', () => {
  it('returns successful response without retry', async () => {
    const fn = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    const result = await withRetry(fn);
    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockResolvedValueOnce(new Response('Rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response('OK', { status: 200 }));

    const promise = withRetry(fn);

    // Fast-forward through the delay
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('retries on 500 and succeeds', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockResolvedValueOnce(new Response('Error', { status: 500 }))
      .mockResolvedValueOnce(new Response('OK', { status: 200 }));

    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not retry on 400', async () => {
    const fn = vi.fn().mockResolvedValue(new Response('Bad request', { status: 400 }));
    const result = await withRetry(fn);
    expect(result.status).toBe(400);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws RETRY_EXHAUSTED after max attempts', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue(new Response('Rate limited', { status: 429 }));

    // Attach catch handler immediately to avoid unhandled rejection
    const resultPromise = withRetry(fn, { maxAttempts: 3, baseDelay: 100 })
      .then(
        () => ({ success: true }),
        (e) => ({ success: false, error: e }),
      );

    await vi.runAllTimersAsync();

    const result = await resultPromise;
    expect(result.success).toBe(false);
    expect((result as { success: false; error: Error & { code: ErrorCode } }).error.code).toBe(ErrorCode.RETRY_EXHAUSTED);
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('uses Retry-After header for delay', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockResolvedValueOnce(new Response('Rate limited', { status: 429, headers: { 'Retry-After': '3' } }))
      .mockResolvedValueOnce(new Response('OK', { status: 200 }));

    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(3000);

    const result = await promise;
    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
