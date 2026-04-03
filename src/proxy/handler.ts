import type { ProxyConfig } from '../config/types.js';
import { ErrorCode, createErrorResponse } from '../config/errors.js';
import { getAdapter } from '../protocols/registry.js';
import { createStreamingResponse } from '../streaming/pipeline.js';
import { resolveModel } from './model-map.js';
import { signRequest } from '../protocols/bedrock/sigv4.js';
import { getEffectiveAuth } from './key-rotation.js';
import { withRetry } from './retry.js';

export async function handleProxyRequest(
  request: Request,
  config: ProxyConfig,
  upstreamPath: string
): Promise<Response> {
  const sourceAdapter = getAdapter(config.sourceProtocol);
  const targetAdapter = getAdapter(config.targetProtocol);

  // Apply key rotation: select effective auth from keys array if configured
  const effectiveAuth = getEffectiveAuth(config.auth);

  // Parse incoming request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(ErrorCode.INVALID_JSON, 'Invalid JSON body');
  }

  // Translate to canonical format
  const canonical = await sourceAdapter.parseRequest(body, request.headers, upstreamPath);

  // Apply model mapping (with wildcard support)
  canonical.model = resolveModel(canonical.model, config.targetProtocol, config.modelMap, config.forceModel);

  // Serialize to target format with effective auth
  const serialized = await targetAdapter.serializeRequest(canonical, { ...config, auth: effectiveAuth });

  // Handle Bedrock SigV4 signing (special case: signing requires async crypto)
  if (config.targetProtocol === 'bedrock') {
    const bedrockAuthStr = serialized.headers['__bedrock_auth__'];
    if (bedrockAuthStr) {
      delete serialized.headers['__bedrock_auth__'];
      const bedrockAuth = JSON.parse(bedrockAuthStr) as { accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string };
      const bodyStr = JSON.stringify(serialized.body);
      const url = new URL(serialized.url);
      const signedHeaders = await signRequest('POST', url, serialized.headers, bodyStr, {
        ...bedrockAuth,
        service: 'bedrock-runtime',
      });
      Object.assign(serialized.headers, signedHeaders);
    }
  }

  // Forward to upstream with retry
  let upstreamResponse: Response;
  try {
    upstreamResponse = await withRetry(() =>
      fetch(serialized.url, {
        method: 'POST',
        headers: serialized.headers,
        body: JSON.stringify(serialized.body),
      })
    );
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === ErrorCode.RETRY_EXHAUSTED) {
      throw err; // Re-throw to be caught by index.ts
    }
    throw new Error(err instanceof Error ? err.message : 'Upstream request failed');
  }

  if (!upstreamResponse.ok) {
    const errBody = await upstreamResponse.text();
    if (upstreamResponse.status === 429) {
      const retryAfter = upstreamResponse.headers.get('Retry-After');
      return createErrorResponse(
        ErrorCode.RATE_LIMITED,
        `Upstream rate limited: ${errBody}`,
        retryAfter ? parseInt(retryAfter, 10) : undefined,
      );
    }
    return createErrorResponse(ErrorCode.UPSTREAM_ERROR, `Upstream error ${upstreamResponse.status}: ${errBody}`);
  }

  // Handle streaming
  if (canonical.stream && upstreamResponse.body) {
    const messageId = `msg_${crypto.randomUUID().replace(/-/g, '')}`;
    const contentType = config.sourceProtocol === 'anthropic'
      ? 'text/event-stream'
      : config.sourceProtocol === 'ollama'
        ? 'application/x-ndjson'
        : 'text/event-stream';

    return createStreamingResponse(
      upstreamResponse.body,
      targetAdapter.createInboundStreamTransformer(),
      sourceAdapter.createOutboundStreamTransformer(canonical.model, messageId),
      contentType
    );
  }

  // Non-streaming: parse and re-serialize
  const upstreamBody = await upstreamResponse.json();
  const canonicalResponse = await targetAdapter.parseResponse(upstreamBody, upstreamResponse.status);

  // Preserve the model name the client requested
  canonicalResponse.model = canonical.model;

  return sourceAdapter.serializeResponse(canonicalResponse);
}
