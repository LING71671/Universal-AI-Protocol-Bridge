// AWS Bedrock adapter - wraps Anthropic Claude models on Bedrock
// Uses SigV4 signing and Bedrock's event-stream for streaming
import type {
  CanonicalRequest, CanonicalResponse, CanonicalStreamEvent
} from '../../canonical/types.js';
import type { ProxyConfig } from '../../config/types.js';
import type { ProtocolAdapter, SerializedRequest } from '../registry.js';
import { parseAnthropicRequest, parseAnthropicResponse, serializeAnthropicResponse, createAnthropicInboundStreamTransformer, createAnthropicOutboundStreamTransformer } from '../anthropic/index.js';
import { createBedrockEventStreamDecoder } from '../../streaming/adapters/bedrock-events.js';
import { chainTransformStreams } from '../../streaming/pipeline.js';
import { signRequest } from './sigv4.js';

// Bedrock request body is the same as Anthropic but without the model field
// and with anthropic_version added
export function serializeBedrockRequest(canonical: CanonicalRequest, config: ProxyConfig): SerializedRequest {
  const auth = config.auth;
  if (auth.type !== 'aws') throw new Error('Bedrock requires AWS auth');

  const messages: unknown[] = [];
  for (const msg of canonical.messages) {
    if (msg.role === 'system') continue;
    const blocks: unknown[] = [];
    for (const part of msg.content) {
      if (part.type === 'text') blocks.push({ type: 'text', text: part.text });
      else if (part.type === 'image') blocks.push({ type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.data } });
      else if (part.type === 'tool_call') blocks.push({ type: 'tool_use', id: part.id, name: part.name, input: part.arguments });
      else if (part.type === 'tool_result') blocks.push({ type: 'tool_result', tool_use_id: part.toolCallId, content: part.content });
    }
    messages.push({ role: msg.role === 'tool' ? 'user' : msg.role, content: blocks });
  }

  const body: Record<string, unknown> = {
    anthropic_version: 'bedrock-2023-05-31',
    messages,
    max_tokens: canonical.maxTokens ?? 4096,
  };
  if (canonical.systemPrompt) body['system'] = canonical.systemPrompt;
  if (canonical.temperature != null) body['temperature'] = canonical.temperature;
  if (canonical.topP != null) body['top_p'] = canonical.topP;
  if (canonical.topK != null) body['top_k'] = canonical.topK;
  if (canonical.stopSequences?.length) body['stop_sequences'] = canonical.stopSequences;
  if (canonical.tools?.length) {
    body['tools'] = canonical.tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  }

  const modelId = canonical.model;
  const endpoint = canonical.stream ? 'invoke-with-response-stream' : 'invoke';
  const url = new URL(`${config.targetBaseUrl}/model/${modelId}/${endpoint}`);
  const bodyStr = JSON.stringify(body);

  // SigV4 signing happens synchronously in serializeRequest but we need async
  // Return a placeholder; actual signing done in handler
  return {
    url: url.toString(),
    body,
    headers: {
      'Content-Type': 'application/json',
      'x-amz-bedrock-accept': '*/*',
      '__bedrock_auth__': JSON.stringify({ accessKeyId: auth.accessKeyId, secretAccessKey: auth.secretAccessKey, sessionToken: auth.sessionToken, region: auth.region }),
    },
  };
}

export function createBedrockInboundStreamTransformer(): TransformStream<Uint8Array, CanonicalStreamEvent> {
  const eventDecoder = createBedrockEventStreamDecoder();
  const blockTypes = new Map<number, string>();
  const mapper = new TransformStream<import('../../streaming/adapters/bedrock-events.js').BedrockEvent, CanonicalStreamEvent>({
    transform(event, controller) {
      if (event.eventType === 'chunk') {
        const payload = event.payload as Record<string, unknown>;
        const bytes = payload['bytes'] as string | undefined;
        if (!bytes) return;
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(atob(bytes)); } catch { return; }

        const type = parsed['type'] as string;
        if (type === 'message_start') {
          const msg = parsed['message'] as Record<string, unknown>;
          const usage = msg['usage'] as Record<string, number> ?? {};
          controller.enqueue({ type: 'message_start', id: msg['id'] as string, model: msg['model'] as string ?? '', inputTokens: usage['input_tokens'] ?? 0 });
        } else if (type === 'content_block_start') {
          const block = parsed['content_block'] as Record<string, unknown>;
          const index = parsed['index'] as number;
          blockTypes.set(index, block['type'] as string);
          if (block['type'] === 'tool_use') {
            controller.enqueue({ type: 'tool_call_start', index, id: block['id'] as string, name: block['name'] as string });
          }
        } else if (type === 'content_block_delta') {
          const delta = parsed['delta'] as Record<string, unknown>;
          const index = parsed['index'] as number;
          if (delta['type'] === 'text_delta') controller.enqueue({ type: 'text_delta', index, text: delta['text'] as string });
          else if (delta['type'] === 'input_json_delta') controller.enqueue({ type: 'tool_call_delta', index, argumentsChunk: delta['partial_json'] as string });
        } else if (type === 'content_block_stop') {
          const index = parsed['index'] as number;
          const blockType = blockTypes.get(index);
          if (blockType === 'tool_use') {
            controller.enqueue({ type: 'tool_call_end', index });
          } else {
            controller.enqueue({ type: 'content_block_end', index });
          }
          blockTypes.delete(index);
        } else if (type === 'message_delta') {
          const delta = parsed['delta'] as Record<string, unknown>;
          const usage = parsed['usage'] as Record<string, number> ?? {};
          const STOP_MAP: Record<string, import('../../canonical/types.js').CanonicalStopReason> = { end_turn: 'end_turn', max_tokens: 'max_tokens', tool_use: 'tool_use', stop_sequence: 'stop_sequence' };
          controller.enqueue({ type: 'message_end', stopReason: STOP_MAP[delta['stop_reason'] as string] ?? 'end_turn', outputTokens: usage['output_tokens'] ?? 0 });
        }
      }
    }
  });
  return chainTransformStreams(eventDecoder, mapper);
}

export const bedrockAdapter: ProtocolAdapter = {
  id: 'bedrock',
  detect(request) {
    const auth = request.headers.get('Authorization') ?? '';
    return auth.startsWith('AWS4-HMAC-SHA256');
  },
  async parseRequest(body) { return parseAnthropicRequest(body); },
  async serializeRequest(canonical, config) { return serializeBedrockRequest(canonical, config); },
  async parseResponse(body) { return parseAnthropicResponse(body); },
  serializeResponse(canonical) { return serializeAnthropicResponse(canonical); },
  createInboundStreamTransformer() { return createBedrockInboundStreamTransformer(); },
  createOutboundStreamTransformer(model, messageId) { return createAnthropicOutboundStreamTransformer(model, messageId); },
};
