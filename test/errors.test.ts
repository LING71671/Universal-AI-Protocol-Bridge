import { describe, it, expect } from 'vitest';
import { ErrorCode, createErrorResponse, getErrorCodeStatus, ERROR_METADATA } from '../src/config/errors.js';

describe('ErrorCode', () => {
  it('has all expected error codes', () => {
    expect(ErrorCode.INVALID_JSON).toBe('INVALID_JSON');
    expect(ErrorCode.MISSING_TOKEN).toBe('MISSING_TOKEN');
    expect(ErrorCode.INVALID_TOKEN).toBe('INVALID_TOKEN');
    expect(ErrorCode.PROXY_ERROR).toBe('PROXY_ERROR');
    expect(ErrorCode.UPSTREAM_ERROR).toBe('UPSTREAM_ERROR');
    expect(ErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
    expect(ErrorCode.UPSTREAM_TIMEOUT).toBe('UPSTREAM_TIMEOUT');
    expect(ErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCode.RETRY_EXHAUSTED).toBe('RETRY_EXHAUSTED');
  });
});

describe('getErrorCodeStatus', () => {
  it('returns correct status for each error code', () => {
    expect(getErrorCodeStatus(ErrorCode.INVALID_JSON)).toBe(400);
    expect(getErrorCodeStatus(ErrorCode.MISSING_TOKEN)).toBe(400);
    expect(getErrorCodeStatus(ErrorCode.INVALID_TOKEN)).toBe(401);
    expect(getErrorCodeStatus(ErrorCode.RATE_LIMITED)).toBe(429);
    expect(getErrorCodeStatus(ErrorCode.INTERNAL_ERROR)).toBe(500);
    expect(getErrorCodeStatus(ErrorCode.RETRY_EXHAUSTED)).toBe(503);
    expect(getErrorCodeStatus(ErrorCode.PROXY_ERROR)).toBe(502);
    expect(getErrorCodeStatus(ErrorCode.UPSTREAM_ERROR)).toBe(502);
    expect(getErrorCodeStatus(ErrorCode.UPSTREAM_TIMEOUT)).toBe(504);
  });
});

describe('ERROR_METADATA', () => {
  it('contains all error codes', () => {
    const codes = Object.values(ErrorCode);
    for (const code of codes) {
      expect(ERROR_METADATA[code]).toBeDefined();
      expect(ERROR_METADATA[code].code).toBe(code);
      expect(typeof ERROR_METADATA[code].status).toBe('number');
    }
  });
});

describe('createErrorResponse', () => {
  it('returns correct JSON format with error_code and message', async () => {
    const response = createErrorResponse(ErrorCode.RATE_LIMITED, 'Rate limited');
    expect(response.status).toBe(429);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body.error_code).toBe('RATE_LIMITED');
    expect(body.message).toBe('Rate limited');
    expect(body.retry_after).toBeUndefined();
  });

  it('includes retry_after when provided', async () => {
    const response = createErrorResponse(ErrorCode.RATE_LIMITED, 'Rate limited', 5);
    const body = await response.json();
    expect(body.retry_after).toBe(5);
  });

  it('excludes retry_after when not provided', async () => {
    const response = createErrorResponse(ErrorCode.INVALID_JSON, 'Bad request');
    const body = await response.json();
    expect(body).not.toHaveProperty('retry_after');
  });

  it('uses correct status for each error code', async () => {
    const cases = [
      { code: ErrorCode.INVALID_JSON, status: 400 },
      { code: ErrorCode.INVALID_TOKEN, status: 401 },
      { code: ErrorCode.INTERNAL_ERROR, status: 500 },
      { code: ErrorCode.RETRY_EXHAUSTED, status: 503 },
      { code: ErrorCode.PROXY_ERROR, status: 502 },
    ];

    for (const { code, status } of cases) {
      const response = createErrorResponse(code, 'test');
      expect(response.status).toBe(status);
    }
  });
});
