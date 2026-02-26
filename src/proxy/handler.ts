import type { ProxyConfig } from '../config/types.js';
import { getAdapter } from '../protocols/registry.js';
import { createStreamingResponse } from '../streaming/pipeline.js';
import { resolveModel } from './model-map.js';
import { signRequest } from '../protocols/bedrock/sigv4.js';

export async function handleProxyRequest(
  request: Request,
  config: ProxyConfig,
  upstreamPath: string
): Promise<Response> {
  const sourceAdapter = getAdapter(config.sourceProtocol);
  const targetAdapter = getAdapter(config.targetProtocol);

  // Parse incoming request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Translate to canonical format
  const canonical = await sourceAdapter.parseRequest(body, request.headers, upstreamPath);

  // Apply model mapping
  canonical.model = resolveModel(canonical.model, config.targetProtocol, config.modelMap, config.forceModel);

  // Serialize to target format
  const serialized = await targetAdapter.serializeRequest(canonical, config);

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

  // Forward to upstream
  const upstreamResponse = await fetch(serialized.url, {
    method: 'POST',
    headers: serialized.headers,
    body: JSON.stringify(serialized.body),
  });

  if (!upstreamResponse.ok) {
    const errBody = await upstreamResponse.text();
    return new Response(errBody, { status: upstreamResponse.status, headers: { 'Content-Type': 'application/json' } });
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
