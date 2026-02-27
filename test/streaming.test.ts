import { describe, it, expect } from 'vitest';
import type { CanonicalStreamEvent } from '../src/canonical/types.js';
import { createOpenAIInboundStreamTransformer, createOpenAIOutboundStreamTransformer } from '../src/protocols/openai/index.js';
import { createAnthropicInboundStreamTransformer, createAnthropicOutboundStreamTransformer } from '../src/protocols/anthropic/index.js';

// Helper: encode SSE text to Uint8Array
function sse(data: string, event?: string): Uint8Array {
  let str = '';
  if (event) str += `event: ${event}\n`;
  str += `data: ${data}\n\n`;
  return new TextEncoder().encode(str);
}

// Helper: collect all canonical events from an inbound transformer
async function collectCanonical(chunks: Uint8Array[], transformer: TransformStream<Uint8Array, CanonicalStreamEvent>): Promise<CanonicalStreamEvent[]> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });
  const reader = source.pipeThrough(transformer).getReader();
  const events: CanonicalStreamEvent[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    events.push(value);
  }
  return events;
}

// Helper: collect all output bytes from an outbound transformer
async function collectBytes(events: CanonicalStreamEvent[], transformer: TransformStream<CanonicalStreamEvent, Uint8Array>): Promise<string> {
  const source = new ReadableStream<CanonicalStreamEvent>({
    start(controller) {
      for (const event of events) controller.enqueue(event);
      controller.close();
    }
  });
  const reader = source.pipeThrough(transformer).getReader();
  const parts: string[] = [];
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(decoder.decode(value));
  }
  return parts.join('');
}

// ── OpenAI Inbound Transformer ──

describe('OpenAI Inbound: text-only response', () => {
  it('emits content_block_end before message_end', async () => {
    const chunks = [
      sse(JSON.stringify({ id: 'chatcmpl-1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'chatcmpl-1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'chatcmpl-1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } })),
      sse('[DONE]'),
    ];
    const events = await collectCanonical(chunks, createOpenAIInboundStreamTransformer());
    const types = events.map(e => e.type);
    expect(types).toEqual(['message_start', 'text_delta', 'content_block_end', 'message_end']);
    // content_block_end at index 0
    const blockEnd = events.find(e => e.type === 'content_block_end')!;
    expect((blockEnd as { index: number }).index).toBe(0);
  });
});

describe('OpenAI Inbound: text + single tool call', () => {
  it('closes text block before tool_call_start, closes tool before message_end', async () => {
    const chunks = [
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { content: 'Let me search' }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'search', arguments: '' } }] }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"q":"test"}' } }] }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 10, completion_tokens: 20 } })),
      sse('[DONE]'),
    ];
    const events = await collectCanonical(chunks, createOpenAIInboundStreamTransformer());
    const types = events.map(e => e.type);

    expect(types).toEqual([
      'message_start',
      'text_delta',
      'content_block_end',  // text block closed
      'tool_call_start',    // tool block opened
      'tool_call_delta',
      'tool_call_end',      // tool block closed
      'message_end',
    ]);

    // Verify indices
    expect((events[1] as { index: number }).index).toBe(0);  // text at 0
    expect((events[2] as { index: number }).index).toBe(0);  // content_block_end at 0
    expect((events[3] as { index: number }).index).toBe(1);  // tool at 1
    expect((events[5] as { index: number }).index).toBe(1);  // tool_call_end at 1
  });
});

describe('OpenAI Inbound: text + multiple tool calls', () => {
  it('assigns unique indices with no collisions', async () => {
    const chunks = [
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { content: 'I will use tools' }, finish_reason: null }] })),
      // Two tool calls starting in the same chunk
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'read', arguments: '' } }, { index: 1, id: 'call_2', type: 'function', function: { name: 'write', arguments: '' } }] }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"path":"a.txt"}' } }] }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { tool_calls: [{ index: 1, function: { arguments: '{"path":"b.txt"}' } }] }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 10, completion_tokens: 30 } })),
      sse('[DONE]'),
    ];
    const events = await collectCanonical(chunks, createOpenAIInboundStreamTransformer());

    // Check tool_call_start indices are unique
    const toolStarts = events.filter(e => e.type === 'tool_call_start') as Array<{ index: number; id: string }>;
    expect(toolStarts).toHaveLength(2);
    expect(toolStarts[0]!.index).toBe(1);  // 0 + 1 offset
    expect(toolStarts[1]!.index).toBe(2);  // 1 + 1 offset

    // Check tool_call_end for both
    const toolEnds = events.filter(e => e.type === 'tool_call_end') as Array<{ index: number }>;
    expect(toolEnds).toHaveLength(2);
    expect(new Set(toolEnds.map(e => e.index)).size).toBe(2);  // unique indices
  });
});

describe('OpenAI Inbound: tool calls only (no text)', () => {
  it('indices start at 0 with no offset', async () => {
    const chunks = [
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'edit', arguments: '' } }] }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"file":"x.ts"}' } }] }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 5, completion_tokens: 10 } })),
      sse('[DONE]'),
    ];
    const events = await collectCanonical(chunks, createOpenAIInboundStreamTransformer());
    const types = events.map(e => e.type);

    expect(types).toEqual([
      'message_start',
      'tool_call_start',
      'tool_call_delta',
      'tool_call_end',
      'message_end',
    ]);

    // Index should be 0 (no text offset)
    expect((events[1] as { index: number }).index).toBe(0);
  });
});

// ── Anthropic Inbound Transformer ──

describe('Anthropic Inbound: block type distinction', () => {
  it('emits content_block_end for text, tool_call_end for tool_use', async () => {
    const chunks = [
      sse(JSON.stringify({ type: 'message_start', message: { id: 'msg_1', model: 'claude-sonnet-4-6', usage: { input_tokens: 10 } } }), 'message_start'),
      sse(JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }), 'content_block_start'),
      sse(JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } }), 'content_block_delta'),
      sse(JSON.stringify({ type: 'content_block_stop', index: 0 }), 'content_block_stop'),
      sse(JSON.stringify({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu_1', name: 'search', input: {} } }), 'content_block_start'),
      sse(JSON.stringify({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"q":"test"}' } }), 'content_block_delta'),
      sse(JSON.stringify({ type: 'content_block_stop', index: 1 }), 'content_block_stop'),
      sse(JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 20 } }), 'message_delta'),
    ];
    const events = await collectCanonical(chunks, createAnthropicInboundStreamTransformer());
    const types = events.map(e => e.type);

    expect(types).toEqual([
      'message_start',
      'text_delta',
      'content_block_end',  // text block → content_block_end (not tool_call_end)
      'tool_call_start',
      'tool_call_delta',
      'tool_call_end',      // tool_use block → tool_call_end
      'message_end',
    ]);
  });
});

// ── End-to-end: OpenAI → Anthropic SSE ──

describe('End-to-end: OpenAI upstream → Anthropic client', () => {
  it('produces correct Anthropic SSE event sequence for tool_use', async () => {
    // Simulate OpenAI upstream SSE
    const openaiChunks = [
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { content: 'Editing file' }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'str_replace_editor', arguments: '' } }] }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"command":"str_replace"}' } }] }, finish_reason: null }] })),
      sse(JSON.stringify({ id: 'c1', object: 'chat.completion.chunk', model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 100, completion_tokens: 50 } })),
      sse('[DONE]'),
    ];

    // Pass through OpenAI inbound → canonical events
    const canonical = await collectCanonical(openaiChunks, createOpenAIInboundStreamTransformer());

    // Pass canonical events through Anthropic outbound
    const output = await collectBytes(canonical, createAnthropicOutboundStreamTransformer('gpt-4o', 'msg_test'));

    // Parse SSE events from output
    const sseEvents = output.split('\n\n').filter(s => s.trim()).map(block => {
      const lines = block.split('\n');
      let event = '';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data = line.slice(6);
      }
      return { event, data };
    }).filter(e => e.data && e.data !== '[DONE]');

    const eventTypes = sseEvents.map(e => e.event);

    // Verify the exact sequence Claude Code expects
    expect(eventTypes).toEqual([
      'message_start',
      'ping',
      'content_block_start',   // text block
      'content_block_delta',   // text delta
      'content_block_stop',    // text block closed BEFORE tool block
      'content_block_start',   // tool_use block
      'content_block_delta',   // input_json_delta
      'content_block_stop',    // tool block closed BEFORE message_delta
      'message_delta',
      'message_stop',
    ]);

    // Verify content_block_start types
    const blockStarts = sseEvents.filter(e => e.event === 'content_block_start').map(e => JSON.parse(e.data));
    expect(blockStarts[0].content_block.type).toBe('text');
    expect(blockStarts[0].index).toBe(0);
    expect(blockStarts[1].content_block.type).toBe('tool_use');
    expect(blockStarts[1].index).toBe(1);
    expect(blockStarts[1].content_block.name).toBe('str_replace_editor');

    // Verify stop_reason
    const messageDelta = sseEvents.find(e => e.event === 'message_delta')!;
    expect(JSON.parse(messageDelta.data).delta.stop_reason).toBe('tool_use');
  });
});
