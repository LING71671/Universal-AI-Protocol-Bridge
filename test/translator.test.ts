import { describe, it, expect } from 'vitest';
import { parseAnthropicRequest, serializeAnthropicRequest, parseAnthropicResponse } from '../src/protocols/anthropic/index.js';
import { parseOpenAIRequest, serializeOpenAIRequest, parseOpenAIResponse } from '../src/protocols/openai/index.js';
import { parseGeminiRequest, parseGeminiResponse } from '../src/protocols/gemini/index.js';
import type { ProxyConfig } from '../src/config/types.js';
import { resolveModel } from '../src/proxy/model-map.js';

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

// ── OpenAI URL normalization ─────────────────────────────────────────────────

describe('OpenAI URL normalization', () => {
  it('appends /v1 when missing', () => {
    const config: ProxyConfig = {
      version: 1, sourceProtocol: 'anthropic', targetProtocol: 'openai',
      targetBaseUrl: 'https://integrate.api.nvidia.com',
      auth: { type: 'bearer', token: 'test' },
    };
    const canonical = parseAnthropicRequest({
      model: 'test', max_tokens: 100, messages: [{ role: 'user', content: 'Hi' }], stream: false,
    });
    const { url } = serializeOpenAIRequest(canonical, config);
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
  });

  it('preserves /v1 when already present', () => {
    const canonical = parseAnthropicRequest({
      model: 'test', max_tokens: 100, messages: [{ role: 'user', content: 'Hi' }], stream: false,
    });
    const { url } = serializeOpenAIRequest(canonical, openAIConfig);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('preserves custom path prefix with version', () => {
    const config: ProxyConfig = {
      version: 1, sourceProtocol: 'anthropic', targetProtocol: 'openai',
      targetBaseUrl: 'https://api.groq.com/openai/v1',
      auth: { type: 'bearer', token: 'test' },
    };
    const canonical = parseAnthropicRequest({
      model: 'test', max_tokens: 100, messages: [{ role: 'user', content: 'Hi' }], stream: false,
    });
    const { url } = serializeOpenAIRequest(canonical, config);
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('strips trailing slash before normalizing', () => {
    const config: ProxyConfig = {
      version: 1, sourceProtocol: 'anthropic', targetProtocol: 'openai',
      targetBaseUrl: 'https://api.openai.com/v1/',
      auth: { type: 'bearer', token: 'test' },
    };
    const canonical = parseAnthropicRequest({
      model: 'test', max_tokens: 100, messages: [{ role: 'user', content: 'Hi' }], stream: false,
    });
    const { url } = serializeOpenAIRequest(canonical, config);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
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

// ── resolveModel ──────────────────────────────────────────────────────────────

describe('resolveModel', () => {
  it('uses DEFAULT_MODEL_MAP when no userModelMap provided', () => {
    expect(resolveModel('claude-sonnet-4-6', 'openai')).toBe('gpt-4o-mini');
    expect(resolveModel('claude-opus-4-6', 'openai')).toBe('gpt-4o');
    expect(resolveModel('claude-sonnet-4-6', 'gemini')).toBe('gemini-2.0-flash');
  });

  it('strips [1m] suffix before looking up DEFAULT_MODEL_MAP', () => {
    expect(resolveModel('claude-sonnet-4-6[1m]', 'openai')).toBe('gpt-4o-mini');
    expect(resolveModel('claude-opus-4-6[1m]', 'openai')).toBe('gpt-4o');
  });

  it('userModelMap takes priority over DEFAULT_MODEL_MAP', () => {
    expect(resolveModel('claude-sonnet-4-6', 'openai', { 'claude-sonnet-4-6': 'gpt-4-turbo' })).toBe('gpt-4-turbo');
  });

  it('forceModel takes priority over everything', () => {
    expect(resolveModel('claude-sonnet-4-6[1m]', 'openai', undefined, 'my-custom-model')).toBe('my-custom-model');
  });

  it('passes through unknown models unchanged', () => {
    expect(resolveModel('some-unknown-model', 'openai')).toBe('some-unknown-model');
  });
});

// ── tool_result role mapping ─────────────────────────────────────────────────

describe('Anthropic tool_result → Canonical role mapping', () => {
  it('converts user message with tool_result to role: tool', () => {
    const req = parseAnthropicRequest({
      model: 'claude-sonnet-4-6', max_tokens: 1024,
      messages: [
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'file content here' }] },
      ],
      stream: false,
    });
    expect(req.messages[0]?.role).toBe('tool');
    expect(req.messages[0]?.content[0]?.type).toBe('tool_result');
  });

  it('preserves user role for normal text messages', () => {
    const req = parseAnthropicRequest({
      model: 'claude-sonnet-4-6', max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
    });
    expect(req.messages[0]?.role).toBe('user');
  });
});

describe('End-to-end tool_result: Anthropic → OpenAI', () => {
  it('tool_result content is preserved through translation', () => {
    const canonical = parseAnthropicRequest({
      model: 'claude-sonnet-4-6', max_tokens: 1024,
      messages: [
        { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'Read', input: { file_path: '/test.txt' } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'Hello World' }] },
      ],
      stream: false,
    });
    const { body } = serializeOpenAIRequest(canonical, openAIConfig);
    const msgs = (body as Record<string, unknown>)['messages'] as Array<Record<string, unknown>>;
    const toolMsg = msgs.find(m => m['role'] === 'tool');
    expect(toolMsg).toBeDefined();
    expect(toolMsg?.['content']).toBe('Hello World');
    expect(toolMsg?.['tool_call_id']).toBe('tu_1');
  });
});

// ── system prompt array format ───────────────────────────────────────────────

describe('Anthropic system prompt formats', () => {
  it('parses string system prompt', () => {
    const req = parseAnthropicRequest({
      model: 'x', max_tokens: 100, messages: [], stream: false,
      system: 'Be helpful',
    });
    expect(req.systemPrompt).toBe('Be helpful');
  });

  it('parses array system prompt (Claude Code format)', () => {
    const req = parseAnthropicRequest({
      model: 'x', max_tokens: 100, messages: [], stream: false,
      system: [
        { type: 'text', text: 'You are a coding assistant.' },
        { type: 'text', text: 'Be concise.' },
      ],
    });
    expect(req.systemPrompt).toBe('You are a coding assistant.\nBe concise.');
  });
});

// ── JSON parsing resilience ──────────────────────────────────────────────────

describe('OpenAI JSON parsing resilience', () => {
  it('handles invalid tool_call arguments gracefully', () => {
    const req = parseOpenAIRequest({
      model: 'gpt-4o',
      messages: [{
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'test', arguments: 'invalid json{' } }],
      }],
    });
    const part = req.messages[0]?.content[0];
    expect(part?.type).toBe('tool_call');
    if (part?.type === 'tool_call') {
      expect(part.arguments).toEqual({});
    }
  });
});
