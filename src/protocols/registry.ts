import type { CanonicalRequest, CanonicalResponse, CanonicalStreamEvent, ProtocolId } from '../canonical/types.js';
import type { ProxyConfig } from '../config/types.js';

export interface SerializedRequest {
  url: string;
  body: unknown;
  headers: Record<string, string>;
}

export interface ProtocolAdapter {
  readonly id: ProtocolId;

  /** Returns true if this adapter should handle the incoming request */
  detect(request: Request, path: string): boolean;

  /** Parse raw incoming request body → CanonicalRequest */
  parseRequest(body: unknown, headers: Headers, path: string): Promise<CanonicalRequest>;

  /** Canonical → upstream HTTP request */
  serializeRequest(canonical: CanonicalRequest, config: ProxyConfig): Promise<SerializedRequest>;

  /** Parse upstream response body → CanonicalResponse */
  parseResponse(body: unknown, status: number): Promise<CanonicalResponse>;

  /** CanonicalResponse → HTTP Response to send to client */
  serializeResponse(canonical: CanonicalResponse): Response;

  /** Converts upstream stream bytes → CanonicalStreamEvents */
  createInboundStreamTransformer(): TransformStream<Uint8Array, CanonicalStreamEvent>;

  /** Converts CanonicalStreamEvents → client stream bytes */
  createOutboundStreamTransformer(model: string, messageId: string): TransformStream<CanonicalStreamEvent, Uint8Array>;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const adapters = new Map<ProtocolId, ProtocolAdapter>();

export function registerAdapter(adapter: ProtocolAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getAdapter(id: ProtocolId): ProtocolAdapter {
  const adapter = adapters.get(id);
  if (!adapter) throw new Error(`No adapter registered for protocol: ${id}`);
  return adapter;
}

// Detection priority order matters - more specific patterns first
const DETECTION_ORDER: ProtocolId[] = [
  'bedrock',    // unique AWS4 auth header
  'gemini',     // unique path pattern
  'azure',      // unique path with /openai/deployments/
  'anthropic',  // x-api-key or anthropic-version header
  'ollama',     // no auth + /api/chat
  'cohere',     // /v2/chat path
  'mistral',    // /v1/chat/completions (before openai)
  'openai',     // fallback for /v1/chat/completions
];

export function detectProtocol(request: Request): ProtocolId | null {
  const path = new URL(request.url).pathname;
  for (const id of DETECTION_ORDER) {
    const adapter = adapters.get(id);
    if (adapter?.detect(request, path)) return id;
  }
  return null;
}
