export enum ErrorCode {
  INVALID_JSON = 'INVALID_JSON',
  MISSING_TOKEN = 'MISSING_TOKEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  PROXY_ERROR = 'PROXY_ERROR',
  UPSTREAM_ERROR = 'UPSTREAM_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  UPSTREAM_TIMEOUT = 'UPSTREAM_TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
}

export interface ErrorCodeMetadata {
  code: ErrorCode;
  status: number;
}

export const ERROR_METADATA: Record<ErrorCode, ErrorCodeMetadata> = {
  [ErrorCode.INVALID_JSON]: { code: ErrorCode.INVALID_JSON, status: 400 },
  [ErrorCode.MISSING_TOKEN]: { code: ErrorCode.MISSING_TOKEN, status: 400 },
  [ErrorCode.INVALID_TOKEN]: { code: ErrorCode.INVALID_TOKEN, status: 401 },
  [ErrorCode.PROXY_ERROR]: { code: ErrorCode.PROXY_ERROR, status: 502 },
  [ErrorCode.UPSTREAM_ERROR]: { code: ErrorCode.UPSTREAM_ERROR, status: 502 },
  [ErrorCode.RATE_LIMITED]: { code: ErrorCode.RATE_LIMITED, status: 429 },
  [ErrorCode.UPSTREAM_TIMEOUT]: { code: ErrorCode.UPSTREAM_TIMEOUT, status: 504 },
  [ErrorCode.INTERNAL_ERROR]: { code: ErrorCode.INTERNAL_ERROR, status: 500 },
  [ErrorCode.RETRY_EXHAUSTED]: { code: ErrorCode.RETRY_EXHAUSTED, status: 503 },
};

export function getErrorCodeStatus(code: ErrorCode): number {
  return ERROR_METADATA[code].status;
}

export interface ErrorResponse {
  error_code: ErrorCode;
  message: string;
  retry_after?: number;
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  retryAfter?: number,
): Response {
  const body: ErrorResponse = {
    error_code: code,
    message,
    ...(retryAfter !== undefined && { retry_after: retryAfter }),
  };

  const status = getErrorCodeStatus(code);
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
