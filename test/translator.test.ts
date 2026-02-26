import { describe, it, expect } from 'vitest';
import { parseAnthropicRequest, serializeAnthropicRequest, parseAnthropicResponse } from '../src/protocols/anthropic/index.js';
import { parseOpenAIRequest, serializeOpenAIRequest, parseOpenAIResponse } from '../src/protocols/openai/index.js';
import { parseGeminiRequest, parseGeminiResponse } from '../src/protocols/gemini/index.js';
import type { ProxyConfig } from '../src/config/types.js';

const openAIConfig: ProxyConfig = {
  version: 1, sourceProtocol: 'anthropic', targetProtocol: 'openai',
  targetBaseUrl: 'https://api.openai.com/v1',
  auth: { type: 'bearer', token: 'sk-test' },
};

// ── Anthropic inbound ─────────────────────────────────────────────────────────

describe('Anthropic → Canonical', () => {
  it('parses basic request', () => {
    const req = parseAnthropicRequest({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'You are helpful',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
    });
    expect(req.model).toBe('claude-sonnet-4-6');
    expect(req.systemPrompt).toBe('You are helpful');
    expect(req.maxTokens).toBe(1024);
    expect(req.messages[0]?.role).toBe('user');
    expect(req.messages[0]?.content[0]).toEqual({ type: 'text', text: 'Hello' });
  });

  it('parses tool_use and tool_result', () => {
    const req = parseAnthropicRequest({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'get_weather', input: { city: 'NYC' } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'Sunny, 72°F' }] },
      ],
      stream: false,
    });
    expect(req.messages[0]?.content[0]?.type).toBe('tool_call');
    expect(req.messages[1]?.content[0]?.type).toBe('tool_result');
  });

  it('maps tool_choice any → required', () => {
    const req = parseAnthropicRequest({
      model: 'x', max_tokens: 100, messages: [],
      tool_choice: { type: 'any' }, stream: false,
    });
    expect(req.toolChoice).toEqual({ type: 'required' });
  });
});

// ── OpenAI inbound ────────────────────────────────────────────────────────────

describe('OpenAI → Canonical', () => {
  it('extracts system prompt from messages', () => {
    const req = parseOpenAIRequest({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Be concise' },
        { role: 'user', content: 'Hi' },
      ],
    });
    expect(req.systemPrompt).toBe('Be concise');
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0]?.role).toBe('user');
  });

  it('parses tool_calls in assistant message', () => {
    const req = parseOpenAIRequest({
      model: 'gpt-4o',
      messages: [{
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{"q":"test"}' } }],
      }],
    });
    const part = req.messages[0]?.content[0];
    expect(part?.type).toBe('tool_call');
    if (part?.type === 'tool_call') {
      expect(part.arguments).toEqual({ q: 'test' });
    }
  });
});

// ── Canonical → OpenAI outbound ───────────────────────────────────────────────

describe('Canonical → OpenAI', () => {
  it('places system prompt as first message', () => {
    const canonical = parseAnthropicRequest({
      model: 'claude-sonnet-4-6', max_tokens: 100,
      system: 'Be helpful',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: false,
    });
    const { body } = serializeOpenAIRequest(canonical, openAIConfig);
    const msgs = (body as Record<string, unknown>)['messages'] as Array<Record<string, unknown>>;
    expect(msgs[0]?.['role']).toBe('system');
    expect(msgs[0]?.['content']).toBe('Be helpful');
  });

  it('converts tool_choice required → required', () => {
    const canonical = parseAnthropicRequest({
      model: 'x', max_tokens: 100, messages: [],
      tool_choice: { type: 'any' }, stream: false,
    });
    const { body } = serializeOpenAIRequest(canonical, openAIConfig);
    expect((body as Record<string, unknown>)['tool_choice']).toBe('required');
  });
});

// ── OpenAI response → Canonical ───────────────────────────────────────────────

describe('OpenAI response → Canonical', () => {
  it('parses text response', () => {
    const res = parseOpenAIResponse({
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1234567890,
      model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
    expect(res.content[0]).toEqual({ type: 'text', text: 'Hello!' });
    expect(res.stopReason).toBe('end_turn');
    expect(res.usage.inputTokens).toBe(10);
  });

  it('maps finish_reason tool_calls → tool_use', () => {
    const res = parseOpenAIResponse({
      id: 'x', object: 'chat.completion', created: 0, model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'fn', arguments: '{}' } }] }, finish_reason: 'tool_calls' }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    });
    expect(res.stopReason).toBe('tool_use');
    expect(res.content[0]?.type).toBe('tool_call');
  });
});

// ── Gemini ────────────────────────────────────────────────────────────────────

describe('Gemini → Canonical', () => {
  it('parses generateContent request', () => {
    const req = parseGeminiRequest({
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      systemInstruction: { parts: [{ text: 'Be helpful' }] },
      generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
    }, '/v1beta/models/gemini-2.0-flash:generateContent');
    expect(req.model).toBe('gemini-2.0-flash');
    expect(req.systemPrompt).toBe('Be helpful');
    expect(req.maxTokens).toBe(512);
    expect(req.messages[0]?.role).toBe('user');
  });

  it('parses Gemini response', () => {
    const res = parseGeminiResponse({
      candidates: [{ content: { parts: [{ text: 'Hi there!' }], role: 'model' }, finishReason: 'STOP', index: 0 }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 },
    });
    expect(res.content[0]).toEqual({ type: 'text', text: 'Hi there!' });
    expect(res.stopReason).toBe('end_turn');
  });
});
