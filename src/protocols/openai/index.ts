import type {
  CanonicalRequest, CanonicalResponse, CanonicalMessage, CanonicalContentPart,
  CanonicalStreamEvent, CanonicalStopReason, CanonicalToolDefinition
} from '../../canonical/types.js';
import type { ProxyConfig } from '../../config/types.js';
import type { ProtocolAdapter, SerializedRequest } from '../registry.js';
import { createSSEDecoder, formatSSE, formatSSEDone } from '../../streaming/adapters/sse.js';
import { chainTransformStreams } from '../../streaming/pipeline.js';

// ── Inbound (OpenAI → Canonical) ──────────────────────────────────────────────

export function parseOpenAIRequest(body: unknown): CanonicalRequest {
  const b = body as Record<string, unknown>;
  const rawMessages = (b['messages'] as Array<Record<string, unknown>>) ?? [];

  let systemPrompt: string | undefined;
  const messages: CanonicalMessage[] = [];

  for (const msg of rawMessages) {
    const role = msg['role'] as string;
    if (role === 'system') {
      systemPrompt = (msg['content'] as string) ?? '';
      continue;
    }
    messages.push(parseOpenAIMessage(msg));
  }

  const tools = (b['tools'] as Array<Record<string, unknown>> | undefined)?.map(parseOpenAITool);

  let toolChoice = undefined;
  const tc = b['tool_choice'];
  if (tc === 'auto') toolChoice = { type: 'auto' as const };
  else if (tc === 'none') toolChoice = { type: 'none' as const };
  else if (tc === 'required') toolChoice = { type: 'required' as const };
  else if (tc && typeof tc === 'object') {
    const tcObj = tc as Record<string, unknown>;
    const fn = tcObj['function'] as Record<string, unknown> | undefined;
    if (fn?.['name']) toolChoice = { type: 'specific' as const, name: fn['name'] as string };
  }

  return {
    model: (b['model'] as string) ?? '',
    messages,
    systemPrompt,
    maxTokens: (b['max_tokens'] ?? b['max_completion_tokens']) as number | undefined,
    temperature: b['temperature'] as number | undefined,
    topP: b['top_p'] as number | undefined,
    stopSequences: typeof b['stop'] === 'string' ? [b['stop']] : b['stop'] as string[] | undefined,
    stream: (b['stream'] as boolean) ?? false,
    tools,
    toolChoice,
  };
}

function parseOpenAIMessage(msg: Record<string, unknown>): CanonicalMessage {
  const role = msg['role'] as string;
  const content: CanonicalContentPart[] = [];

  if (role === 'tool') {
    content.push({
      type: 'tool_result',
      toolCallId: (msg['tool_call_id'] as string) ?? '',
      content: (msg['content'] as string) ?? '',
    });
    return { role: 'tool', content };
  }

  if (role === 'assistant') {
    const text = msg['content'] as string | null;
    if (text) content.push({ type: 'text', text });
    const toolCalls = msg['tool_calls'] as Array<Record<string, unknown>> | undefined;
    if (toolCalls) {
      for (const tc of toolCalls) {
        const fn = tc['function'] as Record<string, string>;
        content.push({
          type: 'tool_call',
          id: (tc['id'] as string) ?? '',
          name: fn['name'] ?? '',
          arguments: JSON.parse(fn['arguments'] ?? '{}'),
        });
      }
    }
    return { role: 'assistant', content };
  }

  // user role
  const rawContent = msg['content'];
  if (typeof rawContent === 'string') {
    content.push({ type: 'text', text: rawContent });
  } else if (Array.isArray(rawContent)) {
    for (const part of rawContent as Array<Record<string, unknown>>) {
      if (part['type'] === 'text') {
        content.push({ type: 'text', text: part['text'] as string });
      } else if (part['type'] === 'image_url') {
        const url = (part['image_url'] as Record<string, string>)['url'] ?? '';
        if (url.startsWith('data:')) {
          const [meta, data] = url.split(',');
          const mediaType = meta?.split(':')[1]?.split(';')[0] ?? 'image/jpeg';
          content.push({ type: 'image', mediaType, data: data ?? '' });
        }
      }
    }
  }

  return { role: 'user', content };
}

function parseOpenAITool(t: Record<string, unknown>): CanonicalToolDefinition {
  const fn = t['function'] as Record<string, unknown>;
  return {
    name: fn['name'] as string,
    description: fn['description'] as string | undefined,
    parameters: fn['parameters'] as CanonicalToolDefinition['parameters'],
  };
}

// ── Outbound (Canonical → OpenAI) ─────────────────────────────────────────────

/** Ensure the base URL includes a version prefix (e.g. /v1) for OpenAI-compatible APIs */
function normalizeOpenAIBaseUrl(baseUrl: string): string {
  const url = baseUrl.replace(/\/+$/, '');
  if (/\/v\d+$/.test(url)) return url;
  return `${url}/v1`;
}

export function serializeOpenAIRequest(canonical: CanonicalRequest, config: ProxyConfig): SerializedRequest {
  const messages: unknown[] = [];

  if (canonical.systemPrompt) {
    messages.push({ role: 'system', content: canonical.systemPrompt });
  }

  for (const msg of canonical.messages) {
    messages.push(...serializeOpenAIMessage(msg));
  }

  const tools = canonical.tools?.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  let toolChoice: unknown;
  const tc = canonical.toolChoice;
  if (tc?.type === 'auto') toolChoice = 'auto';
  else if (tc?.type === 'none') toolChoice = 'none';
  else if (tc?.type === 'required') toolChoice = 'required';
  else if (tc?.type === 'specific') toolChoice = { type: 'function', function: { name: tc.name } };

  const body: Record<string, unknown> = {
    model: canonical.model,
    messages,
    stream: canonical.stream,
  };
  if (canonical.maxTokens != null) body['max_tokens'] = canonical.maxTokens;
  if (canonical.temperature != null) body['temperature'] = canonical.temperature;
  if (canonical.topP != null) body['top_p'] = canonical.topP;
  if (canonical.stopSequences?.length) body['stop'] = canonical.stopSequences;
  if (tools?.length) body['tools'] = tools;
  if (toolChoice !== undefined) body['tool_choice'] = toolChoice;
  if (canonical.stream) body['stream_options'] = { include_usage: true };

  const auth = config.auth;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.type === 'bearer') headers['Authorization'] = `Bearer ${auth.token}`;

  return {
    url: `${normalizeOpenAIBaseUrl(config.targetBaseUrl)}/chat/completions`,
    body,
    headers,
  };
}

function serializeOpenAIMessage(msg: CanonicalMessage): unknown[] {
  if (msg.role === 'tool') {
    return msg.content
      .filter(p => p.type === 'tool_result')
      .map(p => {
        const tr = p as import('../../canonical/types.js').CanonicalToolResultPart;
        return { role: 'tool', tool_call_id: tr.toolCallId, content: tr.content };
      });
  }

  if (msg.role === 'assistant') {
    const textParts = msg.content.filter(p => p.type === 'text');
    const toolCalls = msg.content.filter(p => p.type === 'tool_call');
    const result: Record<string, unknown> = { role: 'assistant', content: textParts.map(p => (p as import('../../canonical/types.js').CanonicalTextPart).text).join('') || null };
    if (toolCalls.length) {
      result['tool_calls'] = toolCalls.map(p => {
        const tc = p as import('../../canonical/types.js').CanonicalToolCallPart;
        return { id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } };
      });
    }
    return [result];
  }

  // user
  const textParts = msg.content.filter(p => p.type === 'text');
  const imageParts = msg.content.filter(p => p.type === 'image');
  if (imageParts.length === 0) {
    return [{ role: 'user', content: textParts.map(p => (p as import('../../canonical/types.js').CanonicalTextPart).text).join('') }];
  }
  const contentArr: unknown[] = [];
  for (const p of msg.content) {
    if (p.type === 'text') contentArr.push({ type: 'text', text: p.text });
    else if (p.type === 'image') contentArr.push({ type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.data}` } });
  }
  return [{ role: 'user', content: contentArr }];
}

// ── Response (OpenAI → Canonical) ─────────────────────────────────────────────

const FINISH_REASON_MAP: Record<string, CanonicalStopReason> = {
  stop: 'end_turn',
  length: 'max_tokens',
  tool_calls: 'tool_use',
  content_filter: 'end_turn',
};

export function parseOpenAIResponse(body: unknown): CanonicalResponse {
  const b = body as Record<string, unknown>;
  const choices = b['choices'] as Array<Record<string, unknown>>;
  const choice = choices[0] ?? {};
  const message = choice['message'] as Record<string, unknown> ?? {};
  const usage = b['usage'] as Record<string, number> ?? {};

  const content: CanonicalContentPart[] = [];
  if (message['content']) content.push({ type: 'text', text: message['content'] as string });
  const toolCalls = message['tool_calls'] as Array<Record<string, unknown>> | undefined;
  if (toolCalls) {
    for (const tc of toolCalls) {
      const fn = tc['function'] as Record<string, string>;
      content.push({ type: 'tool_call', id: tc['id'] as string, name: fn['name'] ?? '', arguments: JSON.parse(fn['arguments'] ?? '{}') });
    }
  }

  return {
    id: `msg_${b['id'] ?? crypto.randomUUID()}`,
    model: b['model'] as string ?? '',
    content,
    stopReason: FINISH_REASON_MAP[choice['finish_reason'] as string] ?? 'end_turn',
    usage: { inputTokens: usage['prompt_tokens'] ?? 0, outputTokens: usage['completion_tokens'] ?? 0 },
  };
}

export function serializeOpenAIResponse(canonical: CanonicalResponse): Response {
  const textContent = canonical.content.find(p => p.type === 'text');
  const toolCalls = canonical.content.filter(p => p.type === 'tool_call');

  const STOP_REASON_MAP: Record<CanonicalStopReason, string> = {
    end_turn: 'stop', tool_use: 'tool_calls', max_tokens: 'length', stop_sequence: 'stop', error: 'stop',
  };

  const message: Record<string, unknown> = {
    role: 'assistant',
    content: textContent ? (textContent as import('../../canonical/types.js').CanonicalTextPart).text : null,
  };
  if (toolCalls.length) {
    message['tool_calls'] = toolCalls.map((p, i) => {
      const tc = p as import('../../canonical/types.js').CanonicalToolCallPart;
      return { id: tc.id, type: 'function', index: i, function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } };
    });
  }

  const body = {
    id: canonical.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: canonical.model,
    choices: [{ index: 0, message, finish_reason: STOP_REASON_MAP[canonical.stopReason] }],
    usage: { prompt_tokens: canonical.usage.inputTokens, completion_tokens: canonical.usage.outputTokens, total_tokens: canonical.usage.inputTokens + canonical.usage.outputTokens },
  };

  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export function createOpenAIInboundStreamTransformer(): TransformStream<Uint8Array, CanonicalStreamEvent> {
  let inputTokens = 0;
  let messageId = '';

  const sseDecoder = createSSEDecoder();
  const mapper = new TransformStream<import('../../streaming/adapters/sse.js').SSEEvent, CanonicalStreamEvent>({
    transform(chunk, controller) {
      if (chunk.data === '[DONE]') return;
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(chunk.data); } catch { return; }

      const usage = parsed['usage'] as Record<string, number> | undefined;
      if (usage) inputTokens = usage['prompt_tokens'] ?? inputTokens;

      const id = parsed['id'] as string | undefined;
      if (id && !messageId) {
        messageId = id;
        controller.enqueue({ type: 'message_start', id: `msg_${id}`, model: parsed['model'] as string ?? '', inputTokens });
      }

      const choices = parsed['choices'] as Array<Record<string, unknown>> | undefined;
      if (!choices?.length) return;
      const choice = choices[0] as Record<string, unknown>;
      const delta = choice['delta'] as Record<string, unknown> | undefined;
      const finishReason = choice['finish_reason'] as string | null;

      if (delta?.['content']) {
        controller.enqueue({ type: 'text_delta', index: 0, text: delta['content'] as string });
      }

      const toolCalls = delta?.['tool_calls'] as Array<Record<string, unknown>> | undefined;
      if (toolCalls) {
        for (const tc of toolCalls) {
          const idx = tc['index'] as number ?? 0;
          if (tc['id']) {
            const fn = tc['function'] as Record<string, string> | undefined;
            controller.enqueue({ type: 'tool_call_start', index: idx, id: tc['id'] as string, name: fn?.['name'] ?? '' });
          }
          const fn = tc['function'] as Record<string, string> | undefined;
          if (fn?.['arguments']) {
            controller.enqueue({ type: 'tool_call_delta', index: idx, argumentsChunk: fn['arguments'] });
          }
        }
      }

      if (finishReason) {
        const outputTokens = (parsed['usage'] as Record<string, number> | undefined)?.['completion_tokens'] ?? 0;
        controller.enqueue({ type: 'message_end', stopReason: FINISH_REASON_MAP[finishReason] ?? 'end_turn', outputTokens });
      }
    }
  });

  return chainTransformStreams(sseDecoder, mapper);
}

export function createOpenAIOutboundStreamTransformer(model: string, messageId: string): TransformStream<CanonicalStreamEvent, Uint8Array> {
  let blockIndex = 0;
  let inputTokens = 0;

  return new TransformStream<CanonicalStreamEvent, Uint8Array>({
    transform(event, controller) {
      if (event.type === 'message_start') {
        inputTokens = event.inputTokens;
        // OpenAI stream starts with role delta
        controller.enqueue(formatSSE(undefined, { id: messageId, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] }));
      } else if (event.type === 'text_delta') {
        controller.enqueue(formatSSE(undefined, { id: messageId, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: event.text }, finish_reason: null }] }));
      } else if (event.type === 'tool_call_start') {
        blockIndex = event.index;
        controller.enqueue(formatSSE(undefined, { id: messageId, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { tool_calls: [{ index: blockIndex, id: event.id, type: 'function', function: { name: event.name, arguments: '' } }] }, finish_reason: null }] }));
      } else if (event.type === 'tool_call_delta') {
        controller.enqueue(formatSSE(undefined, { id: messageId, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { tool_calls: [{ index: event.index, function: { arguments: event.argumentsChunk } }] }, finish_reason: null }] }));
      } else if (event.type === 'error') {
        controller.enqueue(formatSSE(undefined, { error: { message: event.message, type: 'server_error', code: event.code ?? null } }));
        controller.enqueue(formatSSEDone());
      } else if (event.type === 'message_end') {
        const STOP_MAP: Record<string, string> = { end_turn: 'stop', tool_use: 'tool_calls', max_tokens: 'length', stop_sequence: 'stop', error: 'stop' };
        controller.enqueue(formatSSE(undefined, { id: messageId, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: {}, finish_reason: STOP_MAP[event.stopReason] ?? 'stop' }], usage: { prompt_tokens: inputTokens, completion_tokens: event.outputTokens, total_tokens: inputTokens + event.outputTokens } }));
        controller.enqueue(formatSSEDone());
      }
    }
  });
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export const openAIAdapter: ProtocolAdapter = {
  id: 'openai',
  detect(request, path) {
    return path === '/v1/chat/completions' || path.endsWith('/chat/completions');
  },
  async parseRequest(body) { return parseOpenAIRequest(body); },
  async serializeRequest(canonical, config) { return serializeOpenAIRequest(canonical, config); },
  async parseResponse(body) { return parseOpenAIResponse(body); },
  serializeResponse(canonical) { return serializeOpenAIResponse(canonical); },
  createInboundStreamTransformer() { return createOpenAIInboundStreamTransformer(); },
  createOutboundStreamTransformer(model, messageId) { return createOpenAIOutboundStreamTransformer(model, messageId); },
};
