import type {
  CanonicalRequest, CanonicalResponse, CanonicalMessage, CanonicalContentPart,
  CanonicalStreamEvent, CanonicalStopReason, CanonicalToolDefinition
} from '../../canonical/types.js';
import type { ProxyConfig } from '../../config/types.js';
import type { ProtocolAdapter, SerializedRequest } from '../registry.js';
import { createSSEDecoder, formatSSE, formatSSEDone } from '../../streaming/adapters/sse.js';
import { chainTransformStreams } from '../../streaming/pipeline.js';

// ── Inbound (Anthropic → Canonical) ──────────────────────────────────────────

export function parseAnthropicRequest(body: unknown): CanonicalRequest {
  const b = body as Record<string, unknown>;
  const rawMessages = (b['messages'] as Array<Record<string, unknown>>) ?? [];

  const messages: CanonicalMessage[] = rawMessages.map(parseAnthropicMessage);

  const tools = (b['tools'] as Array<Record<string, unknown>> | undefined)?.map(t => ({
    name: t['name'] as string,
    description: t['description'] as string | undefined,
    parameters: t['input_schema'] as CanonicalToolDefinition['parameters'],
  }));

  let toolChoice = undefined;
  const tc = b['tool_choice'] as Record<string, unknown> | undefined;
  if (tc?.['type'] === 'auto') toolChoice = { type: 'auto' as const };
  else if (tc?.['type'] === 'any') toolChoice = { type: 'required' as const };
  else if (tc?.['type'] === 'tool') toolChoice = { type: 'specific' as const, name: tc['name'] as string };

  return {
    model: b['model'] as string ?? '',
    messages,
    systemPrompt: b['system'] as string | undefined,
    maxTokens: b['max_tokens'] as number | undefined,
    temperature: b['temperature'] as number | undefined,
    topP: b['top_p'] as number | undefined,
    topK: b['top_k'] as number | undefined,
    stopSequences: b['stop_sequences'] as string[] | undefined,
    stream: (b['stream'] as boolean) ?? false,
    tools,
    toolChoice,
    userId: (b['metadata'] as Record<string, string> | undefined)?.['user_id'],
  };
}

function parseAnthropicMessage(msg: Record<string, unknown>): CanonicalMessage {
  const role = msg['role'] as 'user' | 'assistant';
  const rawContent = msg['content'];
  const content: CanonicalContentPart[] = [];

  if (typeof rawContent === 'string') {
    content.push({ type: 'text', text: rawContent });
    return { role, content };
  }

  for (const block of rawContent as Array<Record<string, unknown>>) {
    const type = block['type'] as string;
    if (type === 'text') {
      content.push({ type: 'text', text: block['text'] as string });
    } else if (type === 'image') {
      const source = block['source'] as Record<string, string>;
      content.push({ type: 'image', mediaType: source['media_type'] ?? 'image/jpeg', data: source['data'] ?? '' });
    } else if (type === 'tool_use') {
      content.push({ type: 'tool_call', id: block['id'] as string, name: block['name'] as string, arguments: block['input'] as Record<string, unknown> });
    } else if (type === 'tool_result') {
      const resultContent = block['content'];
      const text = typeof resultContent === 'string' ? resultContent
        : Array.isArray(resultContent) ? (resultContent as Array<Record<string, string>>).map(c => c['text']).join('') : '';
      content.push({ type: 'tool_result', toolCallId: block['tool_use_id'] as string, content: text, isError: block['is_error'] as boolean | undefined });
    }
  }

  return { role, content };
}

// ── Outbound (Canonical → Anthropic) ─────────────────────────────────────────

export function serializeAnthropicRequest(canonical: CanonicalRequest, config: ProxyConfig): SerializedRequest {
  const messages: unknown[] = [];

  for (const msg of canonical.messages) {
    const serialized = serializeAnthropicMessage(msg);
    if (serialized) messages.push(serialized);
  }

  const tools = canonical.tools?.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  let toolChoice: unknown;
  const tc = canonical.toolChoice;
  if (tc?.type === 'auto') toolChoice = { type: 'auto' };
  else if (tc?.type === 'required') toolChoice = { type: 'any' };
  else if (tc?.type === 'specific') toolChoice = { type: 'tool', name: tc.name };

  const body: Record<string, unknown> = {
    model: canonical.model,
    messages,
    max_tokens: canonical.maxTokens ?? 4096,
    stream: canonical.stream,
  };
  if (canonical.systemPrompt) body['system'] = canonical.systemPrompt;
  if (canonical.temperature != null) body['temperature'] = canonical.temperature;
  if (canonical.topP != null) body['top_p'] = canonical.topP;
  if (canonical.topK != null) body['top_k'] = canonical.topK;
  if (canonical.stopSequences?.length) body['stop_sequences'] = canonical.stopSequences;
  if (tools?.length) { body['tools'] = tools; body['tool_choice'] = toolChoice ?? { type: 'auto' }; }
  if (canonical.userId) body['metadata'] = { user_id: canonical.userId };

  const auth = config.auth;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (auth.type === 'bearer') headers['Authorization'] = `Bearer ${auth.token}`;
  else if (auth.type === 'x-api-key') headers['x-api-key'] = auth.key;

  return { url: `${config.targetBaseUrl}/v1/messages`, body, headers };
}

function serializeAnthropicMessage(msg: CanonicalMessage): unknown | null {
  if (msg.role === 'system') return null; // handled as top-level system field

  if (msg.role === 'tool') {
    // tool results go into a user message as tool_result blocks
    const blocks = msg.content
      .filter(p => p.type === 'tool_result')
      .map(p => {
        const tr = p as import('../../canonical/types.js').CanonicalToolResultPart;
        return { type: 'tool_result', tool_use_id: tr.toolCallId, content: tr.content, is_error: tr.isError };
      });
    return { role: 'user', content: blocks };
  }

  const blocks: unknown[] = [];
  for (const part of msg.content) {
    if (part.type === 'text') blocks.push({ type: 'text', text: part.text });
    else if (part.type === 'image') blocks.push({ type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.data } });
    else if (part.type === 'tool_call') blocks.push({ type: 'tool_use', id: part.id, name: part.name, input: part.arguments });
    else if (part.type === 'tool_result') blocks.push({ type: 'tool_result', tool_use_id: part.toolCallId, content: part.content });
  }

  return { role: msg.role, content: blocks };
}

// ── Response (Anthropic → Canonical) ─────────────────────────────────────────

const STOP_REASON_MAP: Record<string, CanonicalStopReason> = {
  end_turn: 'end_turn', max_tokens: 'max_tokens', tool_use: 'tool_use', stop_sequence: 'stop_sequence',
};

export function parseAnthropicResponse(body: unknown): CanonicalResponse {
  const b = body as Record<string, unknown>;
  const rawContent = (b['content'] as Array<Record<string, unknown>>) ?? [];
  const usage = b['usage'] as Record<string, number> ?? {};

  const content: CanonicalContentPart[] = [];
  for (const block of rawContent) {
    if (block['type'] === 'text') content.push({ type: 'text', text: block['text'] as string });
    else if (block['type'] === 'tool_use') content.push({ type: 'tool_call', id: block['id'] as string, name: block['name'] as string, arguments: block['input'] as Record<string, unknown> });
    else if (block['type'] === 'thinking') content.push({ type: 'thinking', thinking: block['thinking'] as string });
  }

  return {
    id: b['id'] as string ?? crypto.randomUUID(),
    model: b['model'] as string ?? '',
    content,
    stopReason: STOP_REASON_MAP[b['stop_reason'] as string] ?? 'end_turn',
    stopSequence: b['stop_sequence'] as string | undefined,
    usage: { inputTokens: usage['input_tokens'] ?? 0, outputTokens: usage['output_tokens'] ?? 0 },
  };
}

export function serializeAnthropicResponse(canonical: CanonicalResponse): Response {
  const STOP_MAP: Record<CanonicalStopReason, string> = {
    end_turn: 'end_turn', tool_use: 'tool_use', max_tokens: 'max_tokens', stop_sequence: 'stop_sequence', error: 'end_turn',
  };

  const content = canonical.content.map(part => {
    if (part.type === 'text') return { type: 'text', text: part.text };
    if (part.type === 'tool_call') return { type: 'tool_use', id: part.id, name: part.name, input: part.arguments };
    if (part.type === 'thinking') return { type: 'thinking', thinking: part.thinking };
    return null;
  }).filter(Boolean);

  const body = {
    id: canonical.id,
    type: 'message',
    role: 'assistant',
    content,
    model: canonical.model,
    stop_reason: STOP_MAP[canonical.stopReason],
    stop_sequence: canonical.stopSequence ?? null,
    usage: { input_tokens: canonical.usage.inputTokens, output_tokens: canonical.usage.outputTokens },
  };

  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export function createAnthropicInboundStreamTransformer(): TransformStream<Uint8Array, CanonicalStreamEvent> {
  const sseDecoder = createSSEDecoder();
  const mapper = new TransformStream<import('../../streaming/adapters/sse.js').SSEEvent, CanonicalStreamEvent>({
    transform(chunk, controller) {
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(chunk.data); } catch { return; }

      const type = parsed['type'] as string;
      if (type === 'message_start') {
        const msg = parsed['message'] as Record<string, unknown>;
        const usage = msg['usage'] as Record<string, number> ?? {};
        controller.enqueue({ type: 'message_start', id: msg['id'] as string, model: msg['model'] as string, inputTokens: usage['input_tokens'] ?? 0 });
      } else if (type === 'content_block_delta') {
        const index = parsed['index'] as number;
        const delta = parsed['delta'] as Record<string, unknown>;
        if (delta['type'] === 'text_delta') {
          controller.enqueue({ type: 'text_delta', index, text: delta['text'] as string });
        } else if (delta['type'] === 'input_json_delta') {
          controller.enqueue({ type: 'tool_call_delta', index, argumentsChunk: delta['partial_json'] as string });
        } else if (delta['type'] === 'thinking_delta') {
          controller.enqueue({ type: 'thinking_delta', index, thinking: delta['thinking'] as string });
        }
      } else if (type === 'content_block_start') {
        const index = parsed['index'] as number;
        const block = parsed['content_block'] as Record<string, unknown>;
        if (block['type'] === 'tool_use') {
          controller.enqueue({ type: 'tool_call_start', index, id: block['id'] as string, name: block['name'] as string });
        }
      } else if (type === 'content_block_stop') {
        const index = parsed['index'] as number;
        controller.enqueue({ type: 'tool_call_end', index });
      } else if (type === 'message_delta') {
        const delta = parsed['delta'] as Record<string, unknown>;
        const usage = parsed['usage'] as Record<string, number> ?? {};
        controller.enqueue({ type: 'message_end', stopReason: STOP_REASON_MAP[delta['stop_reason'] as string] ?? 'end_turn', outputTokens: usage['output_tokens'] ?? 0 });
      }
    }
  });
  return chainTransformStreams(sseDecoder, mapper);
}

export function createAnthropicOutboundStreamTransformer(model: string, messageId: string): TransformStream<CanonicalStreamEvent, Uint8Array> {
  let inputTokens = 0;
  const activeBlocks = new Set<number>();

  return new TransformStream<CanonicalStreamEvent, Uint8Array>({
    transform(event, controller) {
      if (event.type === 'message_start') {
        inputTokens = event.inputTokens;
        controller.enqueue(formatSSE('message_start', { type: 'message_start', message: { id: messageId, type: 'message', role: 'assistant', content: [], model, stop_reason: null, stop_sequence: null, usage: { input_tokens: inputTokens, output_tokens: 1 } } }));
        controller.enqueue(formatSSE('ping', { type: 'ping' }));
      } else if (event.type === 'text_delta') {
        if (!activeBlocks.has(event.index)) {
          activeBlocks.add(event.index);
          controller.enqueue(formatSSE('content_block_start', { type: 'content_block_start', index: event.index, content_block: { type: 'text', text: '' } }));
        }
        controller.enqueue(formatSSE('content_block_delta', { type: 'content_block_delta', index: event.index, delta: { type: 'text_delta', text: event.text } }));
      } else if (event.type === 'thinking_delta') {
        if (!activeBlocks.has(event.index)) {
          activeBlocks.add(event.index);
          controller.enqueue(formatSSE('content_block_start', { type: 'content_block_start', index: event.index, content_block: { type: 'thinking', thinking: '' } }));
        }
        controller.enqueue(formatSSE('content_block_delta', { type: 'content_block_delta', index: event.index, delta: { type: 'thinking_delta', thinking: event.thinking } }));
      } else if (event.type === 'tool_call_start') {
        activeBlocks.add(event.index);
        controller.enqueue(formatSSE('content_block_start', { type: 'content_block_start', index: event.index, content_block: { type: 'tool_use', id: event.id, name: event.name, input: {} } }));
      } else if (event.type === 'tool_call_delta') {
        controller.enqueue(formatSSE('content_block_delta', { type: 'content_block_delta', index: event.index, delta: { type: 'input_json_delta', partial_json: event.argumentsChunk } }));
      } else if (event.type === 'tool_call_end') {
        controller.enqueue(formatSSE('content_block_stop', { type: 'content_block_stop', index: event.index }));
        activeBlocks.delete(event.index);
      } else if (event.type === 'error') {
        controller.enqueue(formatSSE('error', { type: 'error', error: { type: 'api_error', message: event.message } }));
      } else if (event.type === 'message_end') {
        // Close any remaining open blocks
        for (const idx of activeBlocks) {
          controller.enqueue(formatSSE('content_block_stop', { type: 'content_block_stop', index: idx }));
        }
        const STOP_MAP: Record<string, string> = { end_turn: 'end_turn', tool_use: 'tool_use', max_tokens: 'max_tokens', stop_sequence: 'stop_sequence', error: 'end_turn' };
        controller.enqueue(formatSSE('message_delta', { type: 'message_delta', delta: { stop_reason: STOP_MAP[event.stopReason] ?? 'end_turn', stop_sequence: null }, usage: { output_tokens: event.outputTokens } }));
        controller.enqueue(formatSSE('message_stop', { type: 'message_stop' }));
        controller.enqueue(formatSSEDone());
      }
    }
  });
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export const anthropicAdapter: ProtocolAdapter = {
  id: 'anthropic',
  detect(request, path) {
    return path === '/v1/messages' || !!request.headers.get('anthropic-version') || !!request.headers.get('x-api-key');
  },
  async parseRequest(body) { return parseAnthropicRequest(body); },
  async serializeRequest(canonical, config) { return serializeAnthropicRequest(canonical, config); },
  async parseResponse(body) { return parseAnthropicResponse(body); },
  serializeResponse(canonical) { return serializeAnthropicResponse(canonical); },
  createInboundStreamTransformer() { return createAnthropicInboundStreamTransformer(); },
  createOutboundStreamTransformer(model, messageId) { return createAnthropicOutboundStreamTransformer(model, messageId); },
};
