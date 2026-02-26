import type {
  CanonicalRequest, CanonicalResponse, CanonicalMessage, CanonicalContentPart,
  CanonicalStreamEvent, CanonicalStopReason
} from '../../canonical/types.js';
import type { ProxyConfig } from '../../config/types.js';
import type { ProtocolAdapter, SerializedRequest } from '../registry.js';
import { createSSEDecoder, formatSSE, formatSSEDone } from '../../streaming/adapters/sse.js';
import { chainTransformStreams } from '../../streaming/pipeline.js';

const STOP_REASON_MAP: Record<string, CanonicalStopReason> = {
  COMPLETE: 'end_turn', MAX_TOKENS: 'max_tokens', TOOL_CALL: 'tool_use', STOP_SEQUENCE: 'stop_sequence', ERROR: 'error',
};

export function parseCohereRequest(body: unknown): CanonicalRequest {
  const b = body as Record<string, unknown>;
  const rawMessages = (b['messages'] as Array<Record<string, unknown>>) ?? [];

  let systemPrompt: string | undefined;
  const messages: CanonicalMessage[] = [];

  for (const msg of rawMessages) {
    const role = msg['role'] as string;
    if (role === 'system') { systemPrompt = (msg['content'] as string) ?? ''; continue; }

    const content: CanonicalContentPart[] = [];
    const rawContent = msg['content'];
    if (typeof rawContent === 'string') {
      content.push({ type: 'text', text: rawContent });
    } else if (Array.isArray(rawContent)) {
      for (const part of rawContent as Array<Record<string, unknown>>) {
        if (part['type'] === 'text') content.push({ type: 'text', text: part['text'] as string });
      }
    }

    const toolCalls = msg['tool_calls'] as Array<Record<string, unknown>> | undefined;
    if (toolCalls) {
      for (const tc of toolCalls) {
        const fn = tc['function'] as Record<string, string> | undefined;
        content.push({ type: 'tool_call', id: tc['id'] as string, name: fn?.['name'] ?? '', arguments: JSON.parse(fn?.['arguments'] ?? '{}') });
      }
    }

    if (role === 'tool') {
      content.push({ type: 'tool_result', toolCallId: msg['tool_call_id'] as string, content: msg['content'] as string ?? '' });
      messages.push({ role: 'tool', content });
    } else {
      messages.push({ role: role as 'user' | 'assistant', content });
    }
  }

  const tools = (b['tools'] as Array<Record<string, unknown>> | undefined)?.map(t => {
    const fn = t['function'] as Record<string, unknown>;
    return { name: fn['name'] as string, description: fn['description'] as string | undefined, parameters: fn['parameters'] as import('../../canonical/types.js').CanonicalToolDefinition['parameters'] };
  });

  return {
    model: b['model'] as string ?? '',
    messages,
    systemPrompt,
    maxTokens: b['max_tokens'] as number | undefined,
    temperature: b['temperature'] as number | undefined,
    topP: b['p'] as number | undefined,
    stopSequences: b['stop_sequences'] as string[] | undefined,
    stream: (b['stream'] as boolean) ?? false,
    tools,
  };
}

export function serializeCohereRequest(canonical: CanonicalRequest, config: ProxyConfig): SerializedRequest {
  const messages: unknown[] = [];
  if (canonical.systemPrompt) messages.push({ role: 'system', content: canonical.systemPrompt });

  for (const msg of canonical.messages) {
    if (msg.role === 'tool') {
      for (const part of msg.content) {
        if (part.type === 'tool_result') {
          messages.push({ role: 'tool', tool_call_id: part.toolCallId, content: part.content });
        }
      }
      continue;
    }
    const textParts = msg.content.filter(p => p.type === 'text');
    const toolCalls = msg.content.filter(p => p.type === 'tool_call');
    const msgObj: Record<string, unknown> = { role: msg.role, content: textParts.map(p => (p as import('../../canonical/types.js').CanonicalTextPart).text).join('') };
    if (toolCalls.length) {
      msgObj['tool_calls'] = toolCalls.map(p => {
        const tc = p as import('../../canonical/types.js').CanonicalToolCallPart;
        return { id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } };
      });
    }
    messages.push(msgObj);
  }

  const tools = canonical.tools?.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

  const body: Record<string, unknown> = { model: canonical.model, messages, stream: canonical.stream };
  if (canonical.maxTokens != null) body['max_tokens'] = canonical.maxTokens;
  if (canonical.temperature != null) body['temperature'] = canonical.temperature;
  if (canonical.topP != null) body['p'] = canonical.topP;
  if (canonical.stopSequences?.length) body['stop_sequences'] = canonical.stopSequences;
  if (tools?.length) body['tools'] = tools;

  const auth = config.auth;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.type === 'bearer') headers['Authorization'] = `Bearer ${auth.token}`;

  return { url: `${config.targetBaseUrl}/v2/chat`, body, headers };
}

export function parseCohereResponse(body: unknown): CanonicalResponse {
  const b = body as Record<string, unknown>;
  const msg = b['message'] as Record<string, unknown> ?? {};
  const rawContent = (msg['content'] as Array<Record<string, unknown>>) ?? [];
  const usage = b['usage'] as Record<string, Record<string, number>> ?? {};

  const content: CanonicalContentPart[] = [];
  for (const block of rawContent) {
    if (block['type'] === 'text') content.push({ type: 'text', text: block['text'] as string });
  }
  const toolCalls = msg['tool_calls'] as Array<Record<string, unknown>> | undefined;
  if (toolCalls) {
    for (const tc of toolCalls) {
      const fn = tc['function'] as Record<string, string>;
      content.push({ type: 'tool_call', id: tc['id'] as string, name: fn['name'] ?? '', arguments: JSON.parse(fn['arguments'] ?? '{}') });
    }
  }

  return {
    id: b['id'] as string ?? crypto.randomUUID(),
    model: '',
    content,
    stopReason: STOP_REASON_MAP[b['finish_reason'] as string] ?? 'end_turn',
    usage: { inputTokens: usage['billed_units']?.['input_tokens'] ?? 0, outputTokens: usage['billed_units']?.['output_tokens'] ?? 0 },
  };
}

export function serializeCohereResponse(canonical: CanonicalResponse): Response {
  const STOP_MAP: Record<CanonicalStopReason, string> = { end_turn: 'COMPLETE', tool_use: 'TOOL_CALL', max_tokens: 'MAX_TOKENS', stop_sequence: 'STOP_SEQUENCE', error: 'ERROR' };
  const content = canonical.content.filter(p => p.type === 'text').map(p => ({ type: 'text', text: (p as import('../../canonical/types.js').CanonicalTextPart).text }));
  const toolCalls = canonical.content.filter(p => p.type === 'tool_call').map(p => {
    const tc = p as import('../../canonical/types.js').CanonicalToolCallPart;
    return { id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } };
  });
  const body = {
    id: canonical.id,
    finish_reason: STOP_MAP[canonical.stopReason],
    message: { role: 'assistant', content, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
    usage: { billed_units: { input_tokens: canonical.usage.inputTokens, output_tokens: canonical.usage.outputTokens } },
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

export function createCohereInboundStreamTransformer(): TransformStream<Uint8Array, CanonicalStreamEvent> {
  const sseDecoder = createSSEDecoder();
  let first = true;
  const mapper = new TransformStream<import('../../streaming/adapters/sse.js').SSEEvent, CanonicalStreamEvent>({
    transform(chunk, controller) {
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(chunk.data); } catch { return; }
      const type = parsed['type'] as string;
      if (type === 'message-start') {
        if (first) { first = false; controller.enqueue({ type: 'message_start', id: parsed['id'] as string ?? crypto.randomUUID(), model: '', inputTokens: 0 }); }
      } else if (type === 'content-delta') {
        const delta = parsed['delta'] as Record<string, unknown> | undefined;
        const msg = delta?.['message'] as Record<string, unknown> | undefined;
        const content = msg?.['content'] as Record<string, unknown> | undefined;
        if (content?.['text']) controller.enqueue({ type: 'text_delta', index: 0, text: content['text'] as string });
      } else if (type === 'message-end') {
        const delta = parsed['delta'] as Record<string, unknown> | undefined;
        const usage = delta?.['usage'] as Record<string, Record<string, number>> | undefined;
        controller.enqueue({ type: 'message_end', stopReason: STOP_REASON_MAP[delta?.['finish_reason'] as string] ?? 'end_turn', outputTokens: usage?.['billed_units']?.['output_tokens'] ?? 0 });
      }
    }
  });
  return chainTransformStreams(sseDecoder, mapper);
}

export function createCohereOutboundStreamTransformer(model: string, messageId: string): TransformStream<CanonicalStreamEvent, Uint8Array> {
  const STOP_MAP: Record<string, string> = { end_turn: 'COMPLETE', tool_use: 'TOOL_CALL', max_tokens: 'MAX_TOKENS', stop_sequence: 'STOP_SEQUENCE', error: 'ERROR' };
  return new TransformStream<CanonicalStreamEvent, Uint8Array>({
    transform(event, controller) {
      if (event.type === 'message_start') {
        controller.enqueue(formatSSE(undefined, { type: 'message-start', id: messageId }));
      } else if (event.type === 'text_delta') {
        controller.enqueue(formatSSE(undefined, { type: 'content-delta', index: 0, delta: { message: { content: { type: 'text', text: event.text } } } }));
      } else if (event.type === 'message_end') {
        controller.enqueue(formatSSE(undefined, { type: 'message-end', delta: { finish_reason: STOP_MAP[event.stopReason] ?? 'COMPLETE', usage: { billed_units: { output_tokens: event.outputTokens } } } }));
      }
    }
  });
}

export const cohereAdapter: ProtocolAdapter = {
  id: 'cohere',
  detect(_request, path) { return path === '/v2/chat'; },
  async parseRequest(body) { return parseCohereRequest(body); },
  async serializeRequest(canonical, config) { return serializeCohereRequest(canonical, config); },
  async parseResponse(body) { return parseCohereResponse(body); },
  serializeResponse(canonical) { return serializeCohereResponse(canonical); },
  createInboundStreamTransformer() { return createCohereInboundStreamTransformer(); },
  createOutboundStreamTransformer(model, messageId) { return createCohereOutboundStreamTransformer(model, messageId); },
};
