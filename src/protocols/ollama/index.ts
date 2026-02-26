import type {
  CanonicalRequest, CanonicalResponse, CanonicalMessage, CanonicalContentPart,
  CanonicalStreamEvent, CanonicalStopReason
} from '../../canonical/types.js';
import type { ProxyConfig } from '../../config/types.js';
import type { ProtocolAdapter, SerializedRequest } from '../registry.js';
import { createJSONLinesDecoder, formatJSONLine } from '../../streaming/adapters/jsonlines.js';
import { chainTransformStreams } from '../../streaming/pipeline.js';

export function parseOllamaRequest(body: unknown): CanonicalRequest {
  const b = body as Record<string, unknown>;
  const rawMessages = (b['messages'] as Array<Record<string, unknown>>) ?? [];

  let systemPrompt: string | undefined;
  const messages: CanonicalMessage[] = [];

  for (const msg of rawMessages) {
    const role = msg['role'] as string;
    if (role === 'system') { systemPrompt = msg['content'] as string; continue; }
    const content: CanonicalContentPart[] = [{ type: 'text', text: (msg['content'] as string) ?? '' }];
    messages.push({ role: role as 'user' | 'assistant', content });
  }

  const options = b['options'] as Record<string, unknown> | undefined;
  return {
    model: b['model'] as string ?? '',
    messages,
    systemPrompt,
    temperature: options?.['temperature'] as number | undefined,
    topP: options?.['top_p'] as number | undefined,
    topK: options?.['top_k'] as number | undefined,
    stream: (b['stream'] as boolean) ?? true,
  };
}

export function serializeOllamaRequest(canonical: CanonicalRequest, config: ProxyConfig): SerializedRequest {
  const messages: unknown[] = [];
  if (canonical.systemPrompt) messages.push({ role: 'system', content: canonical.systemPrompt });
  for (const msg of canonical.messages) {
    const text = msg.content.filter(p => p.type === 'text').map(p => (p as import('../../canonical/types.js').CanonicalTextPart).text).join('');
    messages.push({ role: msg.role, content: text });
  }

  const options: Record<string, unknown> = {};
  if (canonical.temperature != null) options['temperature'] = canonical.temperature;
  if (canonical.topP != null) options['top_p'] = canonical.topP;
  if (canonical.topK != null) options['top_k'] = canonical.topK;

  const body: Record<string, unknown> = { model: canonical.model, messages, stream: canonical.stream };
  if (Object.keys(options).length) body['options'] = options;

  return { url: `${config.targetBaseUrl}/api/chat`, body, headers: { 'Content-Type': 'application/json' } };
}

export function parseOllamaResponse(body: unknown): CanonicalResponse {
  const b = body as Record<string, unknown>;
  const msg = b['message'] as Record<string, unknown> ?? {};
  return {
    id: crypto.randomUUID(),
    model: b['model'] as string ?? '',
    content: [{ type: 'text', text: (msg['content'] as string) ?? '' }],
    stopReason: 'end_turn',
    usage: {
      inputTokens: b['prompt_eval_count'] as number ?? 0,
      outputTokens: b['eval_count'] as number ?? 0,
    },
  };
}

export function serializeOllamaResponse(canonical: CanonicalResponse): Response {
  const text = canonical.content.find(p => p.type === 'text');
  const body = {
    model: canonical.model,
    created_at: new Date().toISOString(),
    message: { role: 'assistant', content: text ? (text as import('../../canonical/types.js').CanonicalTextPart).text : '' },
    done: true,
    prompt_eval_count: canonical.usage.inputTokens,
    eval_count: canonical.usage.outputTokens,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

export function createOllamaInboundStreamTransformer(): TransformStream<Uint8Array, CanonicalStreamEvent> {
  const jsonDecoder = createJSONLinesDecoder();
  let first = true;
  const mapper = new TransformStream<unknown, CanonicalStreamEvent>({
    transform(chunk, controller) {
      const c = chunk as Record<string, unknown>;
      if (first) {
        first = false;
        controller.enqueue({ type: 'message_start', id: crypto.randomUUID(), model: c['model'] as string ?? '', inputTokens: 0 });
      }
      const msg = c['message'] as Record<string, unknown> | undefined;
      if (msg?.['content']) {
        controller.enqueue({ type: 'text_delta', index: 0, text: msg['content'] as string });
      }
      if (c['done']) {
        controller.enqueue({ type: 'message_end', stopReason: 'end_turn', outputTokens: c['eval_count'] as number ?? 0 });
      }
    }
  });
  return chainTransformStreams(jsonDecoder, mapper);
}

export function createOllamaOutboundStreamTransformer(model: string, _messageId: string): TransformStream<CanonicalStreamEvent, Uint8Array> {
  return new TransformStream<CanonicalStreamEvent, Uint8Array>({
    transform(event, controller) {
      if (event.type === 'text_delta') {
        controller.enqueue(formatJSONLine({ model, created_at: new Date().toISOString(), message: { role: 'assistant', content: event.text }, done: false }));
      } else if (event.type === 'message_end') {
        controller.enqueue(formatJSONLine({ model, created_at: new Date().toISOString(), message: { role: 'assistant', content: '' }, done: true, eval_count: event.outputTokens }));
      }
    }
  });
}

export const ollamaAdapter: ProtocolAdapter = {
  id: 'ollama',
  detect(request, path) {
    return path === '/api/chat' && !request.headers.get('Authorization');
  },
  async parseRequest(body) { return parseOllamaRequest(body); },
  async serializeRequest(canonical, config) { return serializeOllamaRequest(canonical, config); },
  async parseResponse(body) { return parseOllamaResponse(body); },
  serializeResponse(canonical) { return serializeOllamaResponse(canonical); },
  createInboundStreamTransformer() { return createOllamaInboundStreamTransformer(); },
  createOutboundStreamTransformer(model, messageId) { return createOllamaOutboundStreamTransformer(model, messageId); },
};
