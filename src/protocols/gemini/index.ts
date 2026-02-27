import type {
  CanonicalRequest, CanonicalResponse, CanonicalMessage, CanonicalContentPart,
  CanonicalStreamEvent, CanonicalStopReason, CanonicalToolDefinition
} from '../../canonical/types.js';
import type { ProxyConfig } from '../../config/types.js';
import type { ProtocolAdapter, SerializedRequest } from '../registry.js';
import { createSSEDecoder, formatSSE } from '../../streaming/adapters/sse.js';
import { chainTransformStreams } from '../../streaming/pipeline.js';

const FINISH_REASON_MAP: Record<string, CanonicalStopReason> = {
  STOP: 'end_turn', MAX_TOKENS: 'max_tokens', SAFETY: 'end_turn', RECITATION: 'end_turn', OTHER: 'end_turn',
};

// ── Inbound (Gemini → Canonical) ──────────────────────────────────────────────

export function parseGeminiRequest(body: unknown, path: string): CanonicalRequest {
  const b = body as Record<string, unknown>;
  const contents = (b['contents'] as Array<Record<string, unknown>>) ?? [];
  const genConfig = b['generationConfig'] as Record<string, unknown> | undefined;
  const sysInstruction = b['systemInstruction'] as Record<string, unknown> | undefined;

  let systemPrompt: string | undefined;
  if (sysInstruction) {
    const parts = sysInstruction['parts'] as Array<Record<string, string>> | undefined;
    systemPrompt = parts?.map(p => p['text']).join('') ?? '';
  }

  const messages: CanonicalMessage[] = contents.map(parseGeminiContent);

  const tools = (b['tools'] as Array<Record<string, unknown>> | undefined)?.flatMap(t => {
    const decls = t['functionDeclarations'] as Array<Record<string, unknown>> | undefined;
    return (decls ?? []).map(d => ({
      name: d['name'] as string,
      description: d['description'] as string | undefined,
      parameters: normalizeGeminiSchema(d['parameters'] as Record<string, unknown>),
    }));
  });

  // Extract model from path: /v1beta/models/{model}:generateContent
  const modelMatch = path.match(/\/models\/([^/:]+)/);
  const model = modelMatch?.[1] ?? '';

  return {
    model,
    messages,
    systemPrompt,
    maxTokens: genConfig?.['maxOutputTokens'] as number | undefined,
    temperature: genConfig?.['temperature'] as number | undefined,
    topP: genConfig?.['topP'] as number | undefined,
    topK: genConfig?.['topK'] as number | undefined,
    stopSequences: genConfig?.['stopSequences'] as string[] | undefined,
    stream: path.includes('streamGenerateContent'),
    tools,
  };
}

function parseGeminiContent(content: Record<string, unknown>): CanonicalMessage {
  const role = content['role'] as string === 'model' ? 'assistant' : 'user';
  const parts = (content['parts'] as Array<Record<string, unknown>>) ?? [];
  const canonicalContent: CanonicalContentPart[] = [];

  for (const part of parts) {
    if (part['text'] != null) {
      canonicalContent.push({ type: 'text', text: part['text'] as string });
    } else if (part['functionCall']) {
      const fc = part['functionCall'] as Record<string, unknown>;
      canonicalContent.push({ type: 'tool_call', id: fc['name'] as string, name: fc['name'] as string, arguments: fc['args'] as Record<string, unknown> ?? {} });
    } else if (part['functionResponse']) {
      const fr = part['functionResponse'] as Record<string, unknown>;
      const resp = fr['response'] as Record<string, unknown> | undefined;
      canonicalContent.push({ type: 'tool_result', toolCallId: fr['name'] as string, content: JSON.stringify(resp ?? {}) });
    } else if (part['inlineData']) {
      const d = part['inlineData'] as Record<string, string>;
      canonicalContent.push({ type: 'image', mediaType: d['mimeType'] ?? 'image/jpeg', data: d['data'] ?? '' });
    }
  }

  const hasToolResult = canonicalContent.some(p => p.type === 'tool_result');
  return { role: hasToolResult ? 'tool' : role, content: canonicalContent };
}

function normalizeGeminiSchema(schema: Record<string, unknown>): CanonicalToolDefinition['parameters'] {
  // Gemini uses uppercase type names (OBJECT, STRING, etc.)
  const normalized = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  normalizeSchemaTypes(normalized);
  return normalized as CanonicalToolDefinition['parameters'];
}

function normalizeSchemaTypes(obj: Record<string, unknown>): void {
  if (typeof obj['type'] === 'string') obj['type'] = (obj['type'] as string).toLowerCase();
  if (obj['properties']) {
    for (const v of Object.values(obj['properties'] as Record<string, unknown>)) {
      if (v && typeof v === 'object') normalizeSchemaTypes(v as Record<string, unknown>);
    }
  }
}

// ── Outbound (Canonical → Gemini) ─────────────────────────────────────────────

export function serializeGeminiRequest(canonical: CanonicalRequest, config: ProxyConfig): SerializedRequest {
  const contents: unknown[] = [];

  for (const msg of canonical.messages) {
    contents.push(serializeGeminiContent(msg));
  }

  const tools = canonical.tools?.length ? [{
    functionDeclarations: canonical.tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: denormalizeGeminiSchema(t.parameters),
    }))
  }] : undefined;

  const body: Record<string, unknown> = { contents };
  if (canonical.systemPrompt) body['systemInstruction'] = { parts: [{ text: canonical.systemPrompt }] };
  if (tools) body['tools'] = tools;

  const genConfig: Record<string, unknown> = {};
  if (canonical.maxTokens != null) genConfig['maxOutputTokens'] = canonical.maxTokens;
  if (canonical.temperature != null) genConfig['temperature'] = canonical.temperature;
  if (canonical.topP != null) genConfig['topP'] = canonical.topP;
  if (canonical.topK != null) genConfig['topK'] = canonical.topK;
  if (canonical.stopSequences?.length) genConfig['stopSequences'] = canonical.stopSequences;
  if (Object.keys(genConfig).length) body['generationConfig'] = genConfig;

  const auth = config.auth;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.type === 'bearer') headers['x-goog-api-key'] = auth.token;

  const endpoint = canonical.stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const url = `${config.targetBaseUrl}/v1beta/models/${canonical.model}:${endpoint}`;

  return { url, body, headers };
}

function serializeGeminiContent(msg: CanonicalMessage): unknown {
  const role = msg.role === 'assistant' ? 'model' : 'user';
  const parts: unknown[] = [];

  for (const part of msg.content) {
    if (part.type === 'text') parts.push({ text: part.text });
    else if (part.type === 'image') parts.push({ inlineData: { mimeType: part.mediaType, data: part.data } });
    else if (part.type === 'tool_call') parts.push({ functionCall: { name: part.name, args: part.arguments } });
    else if (part.type === 'tool_result') parts.push({ functionResponse: { name: part.toolCallId, response: { content: part.content } } });
  }

  return { role, parts };
}

function denormalizeGeminiSchema(schema: CanonicalToolDefinition['parameters']): unknown {
  const copy = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  uppercaseSchemaTypes(copy);
  return copy;
}

function uppercaseSchemaTypes(obj: Record<string, unknown>): void {
  if (typeof obj['type'] === 'string') obj['type'] = (obj['type'] as string).toUpperCase();
  if (obj['properties']) {
    for (const v of Object.values(obj['properties'] as Record<string, unknown>)) {
      if (v && typeof v === 'object') uppercaseSchemaTypes(v as Record<string, unknown>);
    }
  }
}

// ── Response (Gemini → Canonical) ─────────────────────────────────────────────

export function parseGeminiResponse(body: unknown): CanonicalResponse {
  const b = body as Record<string, unknown>;
  const candidates = (b['candidates'] as Array<Record<string, unknown>>) ?? [];
  const candidate = candidates[0] ?? {};
  const content = candidate['content'] as Record<string, unknown> ?? {};
  const parts = (content['parts'] as Array<Record<string, unknown>>) ?? [];
  const usageMeta = b['usageMetadata'] as Record<string, number> ?? {};

  const canonicalContent: CanonicalContentPart[] = [];
  let hasToolCall = false;
  for (const part of parts) {
    if (part['text'] != null) canonicalContent.push({ type: 'text', text: part['text'] as string });
    else if (part['functionCall']) {
      hasToolCall = true;
      const fc = part['functionCall'] as Record<string, unknown>;
      canonicalContent.push({ type: 'tool_call', id: fc['name'] as string, name: fc['name'] as string, arguments: fc['args'] as Record<string, unknown> ?? {} });
    }
  }

  return {
    id: crypto.randomUUID(),
    model: '',
    content: canonicalContent,
    stopReason: hasToolCall ? 'tool_use' : (FINISH_REASON_MAP[candidate['finishReason'] as string] ?? 'end_turn'),
    usage: { inputTokens: usageMeta['promptTokenCount'] ?? 0, outputTokens: usageMeta['candidatesTokenCount'] ?? 0 },
  };
}

export function serializeGeminiResponse(canonical: CanonicalResponse): Response {
  const STOP_MAP: Record<CanonicalStopReason, string> = { end_turn: 'STOP', tool_use: 'STOP', max_tokens: 'MAX_TOKENS', stop_sequence: 'STOP', error: 'OTHER' };
  const parts: unknown[] = [];
  for (const part of canonical.content) {
    if (part.type === 'text') parts.push({ text: part.text });
    else if (part.type === 'tool_call') parts.push({ functionCall: { name: part.name, args: part.arguments } });
  }
  const body = {
    candidates: [{ content: { parts, role: 'model' }, finishReason: STOP_MAP[canonical.stopReason], index: 0 }],
    usageMetadata: { promptTokenCount: canonical.usage.inputTokens, candidatesTokenCount: canonical.usage.outputTokens, totalTokenCount: canonical.usage.inputTokens + canonical.usage.outputTokens },
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export function createGeminiInboundStreamTransformer(): TransformStream<Uint8Array, CanonicalStreamEvent> {
  const sseDecoder = createSSEDecoder();
  let first = true;
  const mapper = new TransformStream<import('../../streaming/adapters/sse.js').SSEEvent, CanonicalStreamEvent>({
    transform(chunk, controller) {
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(chunk.data); } catch { return; }

      if (first) {
        first = false;
        const usageMeta = parsed['usageMetadata'] as Record<string, number> | undefined;
        controller.enqueue({ type: 'message_start', id: crypto.randomUUID(), model: '', inputTokens: usageMeta?.['promptTokenCount'] ?? 0 });
      }

      const candidates = parsed['candidates'] as Array<Record<string, unknown>> | undefined;
      const candidate = candidates?.[0];
      if (!candidate) return;

      const content = candidate['content'] as Record<string, unknown> | undefined;
      const parts = (content?.['parts'] as Array<Record<string, unknown>>) ?? [];

      for (const part of parts) {
        if (part['text'] != null) controller.enqueue({ type: 'text_delta', index: 0, text: part['text'] as string });
        else if (part['functionCall']) {
          const fc = part['functionCall'] as Record<string, unknown>;
          controller.enqueue({ type: 'tool_call_start', index: 0, id: fc['name'] as string, name: fc['name'] as string });
          controller.enqueue({ type: 'tool_call_delta', index: 0, argumentsChunk: JSON.stringify(fc['args'] ?? {}) });
          controller.enqueue({ type: 'tool_call_end', index: 0 });
        }
      }

      if (candidate['finishReason']) {
        const usageMeta = parsed['usageMetadata'] as Record<string, number> | undefined;
        controller.enqueue({ type: 'message_end', stopReason: FINISH_REASON_MAP[candidate['finishReason'] as string] ?? 'end_turn', outputTokens: usageMeta?.['candidatesTokenCount'] ?? 0 });
      }
    }
  });
  return chainTransformStreams(sseDecoder, mapper);
}

export function createGeminiOutboundStreamTransformer(model: string, _messageId: string): TransformStream<CanonicalStreamEvent, Uint8Array> {
  const STOP_MAP: Record<string, string> = { end_turn: 'STOP', tool_use: 'STOP', max_tokens: 'MAX_TOKENS', stop_sequence: 'STOP', error: 'OTHER' };
  return new TransformStream<CanonicalStreamEvent, Uint8Array>({
    transform(event, controller) {
      if (event.type === 'text_delta') {
        const chunk = { candidates: [{ content: { parts: [{ text: event.text }], role: 'model' }, index: 0 }] };
        controller.enqueue(formatSSE(undefined, chunk));
      } else if (event.type === 'message_end') {
        const chunk = { candidates: [{ content: { parts: [], role: 'model' }, finishReason: STOP_MAP[event.stopReason] ?? 'STOP', index: 0 }], usageMetadata: { candidatesTokenCount: event.outputTokens } };
        controller.enqueue(formatSSE(undefined, chunk));
      }
    }
  });
}

export const geminiAdapter: ProtocolAdapter = {
  id: 'gemini',
  detect(_request, path) { return path.includes('/models/') && (path.includes(':generateContent') || path.includes(':streamGenerateContent')); },
  async parseRequest(body, _headers, path) { return parseGeminiRequest(body, path); },
  async serializeRequest(canonical, config) { return serializeGeminiRequest(canonical, config); },
  async parseResponse(body) { return parseGeminiResponse(body); },
  serializeResponse(canonical) { return serializeGeminiResponse(canonical); },
  createInboundStreamTransformer() { return createGeminiInboundStreamTransformer(); },
  createOutboundStreamTransformer(model, messageId) { return createGeminiOutboundStreamTransformer(model, messageId); },
};
